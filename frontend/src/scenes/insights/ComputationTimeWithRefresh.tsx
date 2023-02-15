import { useActions, useValues } from 'kea'
import { insightLogic } from 'scenes/insights/insightLogic'
import { dayjs } from 'lib/dayjs'
import { usePeriodicRerender } from 'lib/hooks/usePeriodicRerender'
import { Button } from 'antd'
import { Tooltip } from 'lib/lemon-ui/Tooltip'

export function ComputationTimeWithRefresh(): JSX.Element | null {
    const { lastRefresh, insightRefreshButtonDisabledReason } = useValues(insightLogic)
    const { loadResults } = useActions(insightLogic)

    usePeriodicRerender(15000)

    return (
        <div className="flex items-center text-muted-alt">
            Computed {lastRefresh ? dayjs(lastRefresh).fromNow() : 'a while ago'}
            <span className="px-1">•</span>
            <Tooltip title={insightRefreshButtonDisabledReason}>
                <Button
                    type="link"
                    size="small"
                    onClick={() => loadResults(true)}
                    disabled={!!insightRefreshButtonDisabledReason}
                    className="p-0"
                >
                    <span className="text-sm">Refresh</span>
                </Button>
            </Tooltip>
        </div>
    )
}
