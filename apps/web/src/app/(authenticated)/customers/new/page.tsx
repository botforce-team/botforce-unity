import { CustomerForm } from '../customer-form'

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New Customer</h1>
      <CustomerForm />
    </div>
  )
}
