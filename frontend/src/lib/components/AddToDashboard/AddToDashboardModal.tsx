import { IconHome } from '@posthog/icons'
import clsx from 'clsx'
import { useActions, useValues } from 'kea'
import { addToDashboardModalLogic } from 'lib/components/AddToDashboard/addToDashboardModalLogic'
import { DashboardPrivilegeLevel } from 'lib/constants'
import { LemonButton } from 'lib/lemon-ui/LemonButton'
import { LemonInput } from 'lib/lemon-ui/LemonInput/LemonInput'
import { LemonModal } from 'lib/lemon-ui/LemonModal'
import { Link } from 'lib/lemon-ui/Link'
import { Tooltip } from 'lib/lemon-ui/Tooltip'
import { pluralize } from 'lib/utils'
import { CSSProperties } from 'react'
import { AutoSizer } from 'react-virtualized/dist/es/AutoSizer'
import { List, ListRowProps, ListRowRenderer } from 'react-virtualized/dist/es/List'
import { teamLogic } from 'scenes/teamLogic'
import { urls } from 'scenes/urls'

import { DashboardBasicType, InsightLogicProps } from '~/types'

interface DashboardRelationRowProps {
    dashboard: DashboardBasicType
    insightProps: InsightLogicProps
    isHighlighted: boolean
    isAlreadyOnDashboard: boolean
    style: CSSProperties
}

const DashboardRelationRow = ({
    style,
    isHighlighted,
    isAlreadyOnDashboard,
    dashboard,
    insightProps,
}: DashboardRelationRowProps): JSX.Element => {
    const { addToDashboard, removeFromDashboard } = useActions(addToDashboardModalLogic(insightProps))
    const { dashboardWithActiveAPICall } = useValues(addToDashboardModalLogic(insightProps))

    const { currentTeam } = useValues(teamLogic)
    const isPrimary = dashboard.id === currentTeam?.primary_dashboard
    return (
        <div
            data-attr="dashboard-list-item"
            /* eslint-disable-next-line react/forbid-dom-props */
            style={style}
            className={clsx('flex items-center space-x-2', isHighlighted && 'highlighted')}
        >
            <Link
                to={urls.dashboard(dashboard.id)}
                className="overflow-hidden text-ellipsis whitespace-nowrap"
                title={dashboard.name}
            >
                {dashboard.name || 'Untitled'}
            </Link>
            {isPrimary && (
                <Tooltip title="Primary dashboards are shown on the project home page">
                    <span className="flex items-center">
                        <IconHome className="text-warning text-base" />
                    </span>
                </Tooltip>
            )}
            <span className="grow" />
            <LemonButton
                type="secondary"
                status={isAlreadyOnDashboard ? 'danger' : 'default'}
                loading={dashboardWithActiveAPICall === dashboard.id}
                disabledReason={
                    dashboard.effective_privilege_level < DashboardPrivilegeLevel.CanEdit
                        ? "You don't have permission to edit this dashboard"
                        : dashboardWithActiveAPICall
                        ? 'Loading...'
                        : ''
                }
                size="small"
                onClick={(e) => {
                    e.preventDefault()
                    isAlreadyOnDashboard ? removeFromDashboard(dashboard.id) : addToDashboard(dashboard.id)
                }}
            >
                {isAlreadyOnDashboard ? 'Remove from dashboard' : 'Add to dashboard'}
            </LemonButton>
        </div>
    )
}

interface SaveToDashboardModalProps {
    isOpen: boolean
    closeModal: () => void
    insightProps: InsightLogicProps
}

export function AddToDashboardModal({ isOpen, closeModal, insightProps }: SaveToDashboardModalProps): JSX.Element {
    const logic = addToDashboardModalLogic(insightProps)

    const { searchQuery, currentDashboards, orderedDashboards, scrollIndex } = useValues(logic)
    const { setSearchQuery, addNewDashboard } = useActions(logic)

    const renderItem: ListRowRenderer = ({ index: rowIndex, style }: ListRowProps): JSX.Element | null => {
        return (
            <DashboardRelationRow
                key={rowIndex}
                dashboard={orderedDashboards[rowIndex]}
                insightProps={insightProps}
                isHighlighted={rowIndex === scrollIndex}
                isAlreadyOnDashboard={currentDashboards.some(
                    (currentDashboard) => currentDashboard.id === orderedDashboards[rowIndex].id
                )}
                style={style}
            />
        )
    }

    return (
        <LemonModal
            onClose={() => {
                closeModal()
                setSearchQuery('')
            }}
            isOpen={isOpen}
            title="Add to dashboard"
            footer={
                <>
                    <div className="flex-1">
                        <LemonButton type="secondary" onClick={addNewDashboard}>
                            Add to a new dashboard
                        </LemonButton>
                    </div>
                    <LemonButton type="secondary" onClick={closeModal}>
                        Close
                    </LemonButton>
                </>
            }
        >
            <div className="space-y-2 w-192 max-w-full">
                <LemonInput
                    data-attr="dashboard-searchfield"
                    type="search"
                    fullWidth
                    placeholder="Search for dashboards..."
                    value={searchQuery}
                    onChange={(newValue) => setSearchQuery(newValue)}
                />
                <div className="text-muted-alt">
                    This insight is referenced on <strong className="text-text-3000">{currentDashboards.length}</strong>{' '}
                    {pluralize(currentDashboards.length, 'dashboard', 'dashboards', false)}
                </div>
                <div className="min-h-[420px]">
                    <AutoSizer>
                        {({ height, width }) => (
                            <List
                                width={width}
                                height={height}
                                rowCount={orderedDashboards.length}
                                overscanRowCount={100}
                                rowHeight={40}
                                rowRenderer={renderItem}
                                scrollToIndex={scrollIndex}
                            />
                        )}
                    </AutoSizer>
                </div>
            </div>
        </LemonModal>
    )
}
