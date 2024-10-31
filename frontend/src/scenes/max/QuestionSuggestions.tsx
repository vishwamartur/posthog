import { IconArrowUpRight, IconGear, IconOpenSidebar, IconShuffle } from '@posthog/icons'
import { LemonButton, LemonSkeleton } from '@posthog/lemon-ui'
import clsx from 'clsx'
import { useActions, useValues } from 'kea'

import { sidePanelSettingsLogic } from '~/layout/navigation-3000/sidepanel/panels/sidePanelSettingsLogic'

import { maxLogic } from './maxLogic'

export function QuestionSuggestions(): JSX.Element {
    const { visibleSuggestions, allSuggestionsLoading, currentProject } = useValues(maxLogic)
    const { askMax, shuffleVisibleSuggestions } = useActions(maxLogic)
    const { openSettingsPanel } = useActions(sidePanelSettingsLogic)

    if (currentProject && !currentProject.product_description) {
        return (
            <LemonButton
                size="xsmall"
                type="primary"
                sideIcon={<IconOpenSidebar />}
                className="relative"
                onClick={() => {
                    openSettingsPanel({ settingId: 'product-description' })
                    setTimeout(() => document.getElementById('product-description-textarea')?.focus(), 1)
                }}
            >
                Tell me a bit about your product, and I'll offer better answers and suggestions
            </LemonButton>
        )
    }

    return (
        <div
            className={clsx(
                'flex items-center justify-center flex-wrap gap-x-2 gap-y-1.5',
                !visibleSuggestions && allSuggestionsLoading ? 'w-[min(40rem,100%)]' : 'w-[min(48rem,100%)]'
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
                        <div className="flex gap-2">
                            <LemonButton
                                onClick={shuffleVisibleSuggestions}
                                size="xsmall"
                                type="secondary"
                                icon={<IconShuffle />}
                                tooltip="Shuffle suggestions"
                            />
                            <LemonButton
                                onClick={() => openSettingsPanel({ settingId: 'product-description' })}
                                size="xsmall"
                                type="secondary"
                                icon={<IconGear />}
                                tooltip="Edit product description"
                            />
                        </div>
                    </>
                ) : allSuggestionsLoading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                        <LemonButton
                            key={index}
                            size="xsmall"
                            type="secondary"
                            disabled
                            style={{
                                flexGrow: [2, 1.5, 3, 1][index],
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
