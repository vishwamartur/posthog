import { useValues } from 'kea'
import { Resizer } from 'lib/components/Resizer/Resizer'
import { CodeEditor } from 'lib/monaco/CodeEditor'
import { AutoSizer } from 'react-virtualized/dist/es/AutoSizer'

import { editorSizingLogic } from './editorSizingLogic'

export function QueryPane(): JSX.Element {
    const { queryPaneHeight, queryPaneResizerProps } = useValues(editorSizingLogic)
    return (
        <div
            className="relative flex flex-col w-full bg-bg-3000"
            // eslint-disable-next-line react/forbid-dom-props
            style={{
                height: `${queryPaneHeight}px`,
            }}
            ref={queryPaneResizerProps.containerRef}
        >
            <div className="flex-1">
                <AutoSizer>
                    {({ height, width }) => (
                        <CodeEditor className="border" language="json" value="Hello" height={height} width={width} />
                    )}
                </AutoSizer>
            </div>
            <Resizer {...queryPaneResizerProps} />
        </div>
    )
}
