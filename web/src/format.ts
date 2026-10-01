const hours = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

export const formatHours = (value: number) => hours.format(value)
