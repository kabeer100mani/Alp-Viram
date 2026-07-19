import { useSection } from '@/app/section-context'
import { PeopleScreen } from '@/modules/people/components/PeopleScreen'

/** People section (PDL-048): members, roles, invites, offboarding. */
export function PeopleSection() {
  const { userId, org, isAdmin, isOwner } = useSection()
  return (
    <PeopleScreen
      organizationId={org.id}
      isAdmin={isAdmin}
      isOwner={isOwner}
      orgName={org.name}
      currentUserId={userId}
    />
  )
}
