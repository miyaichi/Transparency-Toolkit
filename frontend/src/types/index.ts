export type ValidationRecord = {
  line_number: number
  raw_line: string
  is_valid: boolean
  domain?: string
  account_id?: string
  account_type?: string
  relationship?: string
  variable_type?: string
  value?: string
  has_warning?: boolean
  warning_message?: string
  validation_key?: string
}

export type ValidationStats = {
  total: number
  valid: number
  invalid: number
  warnings: number
}

export type ValidationResponse = {
  domain: string
  ads_txt_url: string
  records: ValidationRecord[]
  stats: ValidationStats
  scan_id?: string
}

export type Seller = {
  seller_id: string
  domain: string
  seller_type: string
  name: string
  is_confidential: boolean
  updated_at: string
}
