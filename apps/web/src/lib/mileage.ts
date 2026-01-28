// Mileage calculation helper
export function calculateMileageExpense(
  distanceKm: number,
  ratePerKm: number = 0.42 // Default Austrian official rate
): { amount: number; description: string } {
  const amount = Math.round(distanceKm * ratePerKm * 100) / 100
  const description = `Mileage: ${distanceKm} km @ €${ratePerKm.toFixed(2)}/km`
  return { amount, description }
}
