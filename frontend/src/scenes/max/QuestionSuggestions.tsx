import { IconArrowUpRight, IconShuffle } from '@posthog/icons'
import { LemonButton, LemonSkeleton } from '@posthog/lemon-ui'
import clsx from 'clsx'
import { useActions, useValues } from 'kea'
import { useEffect } from 'react'

import { maxLogic } from './maxLogic'

export function QuestionSuggestions(): JSX.Element {
    const { visibleSuggestions, wasSuggestionLoadingInitiated, allSuggestionsLoading } = useValues(maxLogic)
    const { askMax, loadSuggestions, shuffleVisibleSuggestions } = useActions(maxLogic)

    useEffect(() => {
        if (!wasSuggestionLoadingInitiated) {
            loadSuggestions()
        }
    }, [wasSuggestionLoadingInitiated, loadSuggestions])

    return (
        <div
            className={clsx(
                'flex items-center justify-center flex-wrap gap-x-2 gap-y-1.5',
                allSuggestionsLoading && !visibleSuggestions ? 'w-[min(48rem,100%)]' : 'w-full'
            )}
        >
            {
                visibleSuggestions ? (
                    <>
                        {visibleSuggestions.map((suggestion, index) => (
                            <LemonButton
                                key={index}
                                onClick={() => askMax(suggestion)}
                                size="xsmall"
                                type="secondary"
                                sideIcon={<IconArrowUpRight />}
                            >
                                {suggestion}
                            </LemonButton>
                        ))}
                        <LemonButton
                            onClick={shuffleVisibleSuggestions}
                            size="xsmall"
                            type="secondary"
                            icon={<IconShuffle />}
                            tooltip="Shuffle suggestions"
                        />
                    </>
                ) : allSuggestionsLoading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                        <LemonButton
                            key={index}
                            size="xsmall"
                            type="secondary"
                            disabled
                            style={{
                                flexGrow: [2.5, 2, 3, 1.5][index],
                            }}
                        >
                            <LemonSkeleton className="h-3 w-full" />
                        </LemonButton>
                    ))
                ) : null /* Some error */
            }
        </div>
    )
}
