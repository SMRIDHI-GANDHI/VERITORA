const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/
const PHONE_RE = /(?:\+?\d[\s-]?){10,13}/
const ID12_RE = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/
const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/

function luhnOk(num: string) {
  const digits = num.replace(/\D/g, '').split('').map(Number)
  if (digits.length < 13 || digits.length > 19) return false
  let checksum = 0
  const parity = digits.length % 2
  digits.forEach((d, i) => {
    let val = d
    if (i % 2 === parity) {
      val *= 2
      if (val > 9) val -= 9
    }
    checksum += val
  })
  return checksum % 10 === 0
}

export function detectPii(text: string): string[] {
  const warnings: string[] = []
  if (EMAIL_RE.test(text)) warnings.push('email_detected')
  if (PHONE_RE.test(text)) warnings.push('phone_detected')
  if (ID12_RE.test(text)) warnings.push('id_number_like_detected')
  for (const m of text.match(CARD_RE) || []) {
    if (luhnOk(m)) {
      warnings.push('card_like_detected')
      break
    }
  }
  return Array.from(new Set(warnings)).sort()
}

export function maskPii(text: string): string {
  let out = text
  out = out.replace(EMAIL_RE, '[email redacted]')
  out = out.replace(ID12_RE, '[id redacted]')
  out = out.replace(CARD_RE, (m) => (luhnOk(m) ? '[card redacted]' : m))
  out = out.replace(PHONE_RE, '[phone redacted]')
  return out
}