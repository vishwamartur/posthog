import { useActions, useValues } from 'kea'
import { useState } from 'react'
import { SceneExport } from 'scenes/sceneTypes'

import { hogReplLogic } from './hogReplLogic'

export function HogRepl(): JSX.Element {
    const { replChunks } = useValues(hogReplLogic)
    const { runCode } = useActions(hogReplLogic)
    const [currentCode, setCurrentCode] = useState('')

    const handleKeyDown = (e): void => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (currentCode.trim() !== '') {
                runCode(currentCode)
                setCurrentCode('')
            }
        }
    }

    return (
        <div className="p-4 bg-white text-black font-mono">
            <div className="space-y-4">
                {replChunks.map(({ code, result, error, status }, index) => (
                    <div key={index} className="pb-2 border-b border-gray-300">
                        <div className="flex items-start">
                            <span
                                // eslint-disable-next-line react/forbid-dom-props
                                style={{ color: 'blue' }}
                            >
                                {'>'}
                            </span>
                            <div className="flex-1 whitespace-pre-wrap ml-2">{code}</div>
                        </div>
                        {status === 'pending' && (
                            <div className="flex items-center ml-4 mt-2">
                                <svg
                                    className="animate-spin h-5 w-5 text-gray-500 mr-2"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                            </div>
                        )}
                        {status === 'success' && (
                            <div className="flex items-start mt-2">
                                <span
                                    // eslint-disable-next-line react/forbid-dom-props
                                    style={{ color: 'green' }}
                                >
                                    {'<'}
                                </span>
                                <div className="flex-1 whitespace-pre-wrap ml-2">{String(result)}</div>
                            </div>
                        )}
                        {status === 'error' && (
                            <div className="flex items-start mt-2">
                                <span className="text-danger">!</span>
                                <div className="flex-1 whitespace-pre-wrap ml-2 text-danger">{error}</div>
                            </div>
                        )}
                    </div>
                ))}
                <div className="flex items-start">
                    <span
                        // eslint-disable-next-line react/forbid-dom-props
                        style={{ color: 'blue' }}
                    >
                        {'>'}
                    </span>
                    <textarea
                        className="flex-1 bg-transparent focus:outline-none resize-none ml-2 p-0"
                        value={currentCode}
                        onChange={(e) => setCurrentCode(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        autoFocus
                    />
                </div>
            </div>
        </div>
    )
}

export const scene: SceneExport = {
    component: HogRepl,
    logic: hogReplLogic,
}
