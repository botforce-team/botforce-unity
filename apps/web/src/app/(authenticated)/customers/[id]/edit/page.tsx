import { notFound } from 'next/navigation'
import { getCustomer } from '@/app/actions/customers'
import { CustomerForm } from '../../customer-form'

interface EditCustomerPageProps {
  params: Promise<{ id: string }>
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { id } = await params
  const customer = await getCustomer(id)

  if (!customer) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit Customer</h1>
      <CustomerForm customer={customer} />
    </div>
  )
}
