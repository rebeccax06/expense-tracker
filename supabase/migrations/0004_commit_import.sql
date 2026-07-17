-- Atomic import commit. Runs in a single transaction (function body), respects
-- RLS (security invoker), and derives the user from auth.uid() rather than
-- trusting client input. Duplicate transactions (by fingerprint) are skipped.
create or replace function commit_import(
  p_account_id uuid,
  p_format_id uuid,
  p_filename text,
  p_file_hash text,
  p_storage_path text,
  p_rows jsonb,
  p_skip_duplicates boolean default true
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user uuid := auth.uid();
  v_batch uuid;
  v_row jsonb;
  v_raw_id uuid;
  v_imported int := 0;
  v_skipped int := 0;
  v_total int := coalesce(jsonb_array_length(p_rows), 0);
  v_exists boolean;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- Ensure the account belongs to the caller (RLS also enforces this).
  if not exists (select 1 from accounts where id = p_account_id and user_id = v_user) then
    raise exception 'Account not found';
  end if;

  insert into import_batches(
    user_id, account_id, format_id, filename, file_hash, storage_path, status, total_rows
  )
  values (v_user, p_account_id, p_format_id, p_filename, p_file_hash, p_storage_path, 'pending', v_total)
  returning id into v_batch;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    if p_skip_duplicates then
      select exists(
        select 1 from transactions
        where user_id = v_user and fingerprint = v_row->>'fingerprint'
      ) into v_exists;
      if v_exists then
        v_skipped := v_skipped + 1;
        continue;
      end if;
    end if;

    insert into raw_imports(user_id, batch_id, row_number, raw, parse_status)
    values (
      v_user, v_batch, (v_row->>'row_number')::int,
      coalesce(v_row->'raw', '{}'::jsonb), 'parsed'
    )
    returning id into v_raw_id;

    insert into transactions(
      user_id, account_id, raw_import_id, batch_id, fingerprint,
      transaction_date, posting_date, raw_description, merchant,
      raw_amount, normalized_spending_amount, bank_category, bank_type,
      normalized_type, include_in_spending
    ) values (
      v_user, p_account_id, v_raw_id, v_batch, v_row->>'fingerprint',
      (v_row->>'transaction_date')::date,
      nullif(v_row->>'posting_date', '')::date,
      v_row->>'raw_description',
      nullif(v_row->>'merchant', ''),
      (v_row->>'raw_amount')::numeric,
      (v_row->>'normalized_spending_amount')::numeric,
      nullif(v_row->>'bank_category', ''),
      nullif(v_row->>'bank_type', ''),
      (v_row->>'normalized_type')::normalized_txn_type,
      coalesce((v_row->>'include_in_spending')::boolean, true)
    )
    on conflict (user_id, fingerprint) do nothing;

    if found then
      v_imported := v_imported + 1;
    else
      -- Lost a race / unexpected dup: drop the now-orphan raw row.
      delete from raw_imports where id = v_raw_id;
      v_skipped := v_skipped + 1;
    end if;
  end loop;

  update import_batches
    set status = 'committed', imported_rows = v_imported, skipped_rows = v_skipped
    where id = v_batch;

  return jsonb_build_object(
    'batch_id', v_batch,
    'imported', v_imported,
    'skipped', v_skipped,
    'total', v_total
  );
end;
$$;

grant execute on function commit_import(uuid, uuid, text, text, text, jsonb, boolean) to authenticated;
