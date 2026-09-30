import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = fs.readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
const supabase = createClient(url, key)

const { count, error: cErr } = await supabase
  .from('bank_transactions')
  .select('*', { count: 'exact', head: true })
console.log('total row count (exact):', count, cErr)

const { data, error } = await supabase
  .from('bank_transactions')
  .select('id, bank_account_id, txn_type, amount, txn_date, description, status, created_at')
console.log('rows fetched:', data?.length, error)

const byType = {}
;(data||[]).forEach(t => { byType[t.txn_type] = (byType[t.txn_type]||0) + Number(t.amount) })
console.log('sum by txn_type:', byType)

// distinct bank_account_ids referenced
const ids = [...new Set((data||[]).map(t => t.bank_account_id))]
console.log('distinct bank_account_ids in txns:', ids)
