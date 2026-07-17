-- Reporting view: normalized transactions with user overrides applied and the
-- "effective spending" computed. Mirrors src/domain/transactions/normalization.ts
-- (keep both in sync). security_invoker makes the view respect the caller's RLS.
create or replace view transactions_view
with (security_invoker = on)
as
select
  t.id,
  t.user_id,
  t.account_id,
  t.fingerprint,
  t.raw_import_id,
  t.batch_id,
  t.transaction_date,
  t.posting_date,
  t.raw_description,
  t.merchant,
  t.raw_amount,
  t.normalized_spending_amount,
  t.bank_category,
  t.bank_type,
  t.normalized_type,
  t.include_in_spending,
  t.created_at,
  t.updated_at,
  a.name        as account_name,
  a.account_type,
  o.user_category_id,
  o.trip_id,
  o.location,
  o.notes,
  o.type_override,
  o.include_override,
  c.name        as category_name,
  c.color       as category_color,
  tr.name       as trip_name,
  coalesce(o.type_override, t.normalized_type)      as resolved_type,
  coalesce(o.include_override, t.include_in_spending) as resolved_include,
  case
    when coalesce(o.include_override, t.include_in_spending) = false then 0
    else
      case coalesce(o.type_override, t.normalized_type)
        when 'transfer' then 0
        when 'income'   then 0
        when 'refund'   then -abs(t.normalized_spending_amount)
        when 'expense'  then  abs(t.normalized_spending_amount)
        else t.normalized_spending_amount
      end
  end as effective_spending
from transactions t
join accounts a on a.id = t.account_id
left join transaction_overrides o
  on o.user_id = t.user_id and o.fingerprint = t.fingerprint
left join categories c on c.id = o.user_category_id
left join trips tr on tr.id = o.trip_id;

grant select on transactions_view to authenticated;
