import { useState } from 'react'
import { useSection } from '@/app/section-context'
import { ListTreeNav } from '@/modules/lists/components/ListTreeNav'
import { useAllLists, useItemsInList } from '@/modules/lists/hooks/use-lists'
import { ItemTable } from '@/modules/items/components/ItemTable'
import { singleGroup } from '@/modules/items/grouping'
import { useRoles } from '@/modules/people/hooks/use-roles'
import { useMembers } from '@/modules/people/hooks/use-people'

/**
 * Projects section (PDL-048): the Projects → Folders → Lists tree, promoted from the
 * old rail to its own section. Selecting a list shows its items.
 */
export function ProjectsSection() {
  const { userId, org, isSolo } = useSection()
  const [activeList, setActiveList] = useState<{ id: string; name: string } | undefined>()

  const { data: listItems, isLoading } = useItemsInList(org.id, activeList?.id)
  const { data: allLists } = useAllLists(org.id)
  // Responsibility context feeds the table's Assignee column (team only).
  const { data: teamRoles } = useRoles(org.id, !isSolo)
  const { data: teamMembers } = useMembers(isSolo ? undefined : org.id)
  const responsibility =
    !isSolo && teamRoles && teamMembers
      ? { organizationId: org.id, currentUserId: userId, roles: teamRoles, members: teamMembers }
      : undefined

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      <div className="w-full shrink-0 border-b border-border pb-3 md:w-64 md:border-b-0 md:border-r md:pb-0 md:pr-3">
        <ListTreeNav
          organizationId={org.id}
          currentUserId={userId}
          activeListId={activeList?.id}
          onSelectList={(id, name) => setActiveList({ id, name })}
        />
      </div>
      <section className="min-w-0 flex-1 space-y-3">
        {activeList ? (
          <>
            <h2 className="text-sm font-semibold">{activeList.name}</h2>
            <ItemTable
              groups={singleGroup(activeList.name, listItems)}
              isLoading={isLoading}
              emptyMessage="This list is empty — file an item into it from triage or the task panel."
              responsibility={responsibility}
              organizationId={org.id}
              currentUserId={userId}
              lists={allLists}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pick a list from the tree to see its items. Projects and folders are optional — an
            unfiled item just lives in the Inbox.
          </p>
        )}
      </section>
    </div>
  )
}
