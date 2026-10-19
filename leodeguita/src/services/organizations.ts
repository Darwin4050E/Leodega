import client from '../api/client'

export type OrganizationRole = 'admin' | 'member'

export interface Organization {
  id: number
  name: string
  ruc: string
  email: string
  logo: string | null
  status: string
  role: OrganizationRole
}

/** The tenant's organizations, in API order. A non-array body is a failure, never an empty list. */
export async function listOrganizations(): Promise<Organization[]> {
  const { data } = await client.get<unknown>('/organizations')
  if (!Array.isArray(data)) {
    throw new Error('Unexpected organizations response')
  }
  return data as Organization[]
}
