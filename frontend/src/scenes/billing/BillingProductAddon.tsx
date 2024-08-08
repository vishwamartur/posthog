import { IconCheckCircle, IconPlus } from '@posthog/icons'
import { LemonButton, LemonSelectOptions, LemonSwitch, LemonTag, Link, Tooltip } from '@posthog/lemon-ui'
import { useActions, useValues } from 'kea'
import { UNSUBSCRIBE_SURVEY_ID } from 'lib/constants'
import { More } from 'lib/lemon-ui/LemonButton/More'
import { ReactNode, useMemo, useRef, useState } from 'react'
import { getProductIcon } from 'scenes/products/Products'

import { BillingProductV2AddonType } from '~/types'

import { getProration } from './billing-utils'
import { billingLogic } from './billingLogic'
import { billingProductLogic } from './billingProductLogic'
import { ProductPricingModal } from './ProductPricingModal'
import { UnsubscribeSurveyModal } from './UnsubscribeSurveyModal'

const formatFlatRate = (flatRate: number, unit: string | null): string | ReactNode => {
    if (!unit) {
        return `$${flatRate}`
    }
    return (
        <span className="space-x-0.5">
            <span className='text-lg'>${Number(flatRate)}</span>
            <span>/</span>
            <span className="text-sm text-muted">{unit}</span>
        </span>
    )
}

const PricingSection = ({ addon, productRef }: { addon: BillingProductV2AddonType, productRef: React.RefObject<HTMLDivElement> }) => {
    const { billing, redirectPath, billingError, timeTotalInSeconds, timeRemainingInSeconds } = useValues(billingLogic)
    const { currentAndUpgradePlans, billingProductLoading } = useValues(
        billingProductLogic({ product: addon, productRef })
    )
    const { toggleIsPricingModalOpen, reportSurveyShown, setSurveyResponse, initiateProductUpgrade } = useActions(
        billingProductLogic({ product: addon })
    )

    const [interval, setInterval] = useState()

    const upgradePlan = currentAndUpgradePlans?.upgradePlan

    const { prorationAmount, isProrated } = useMemo(
        () =>
            getProration({
                timeRemainingInSeconds,
                timeTotalInSeconds,
                amountUsd: upgradePlan?.unit_amount_usd,
                hasActiveSubscription: billing?.has_active_subscription,
            }),
        [billing?.has_active_subscription, upgradePlan, timeRemainingInSeconds, timeTotalInSeconds]
    )

    // If the addon is subscribed and not included with the main product, show the remove button
    if (addon.subscribed && !addon.inclusion_only) {
        return (
            <div className="ml-4 mt-2 self-center flex items-center justify-end gap-x-3 whitespace-nowrap">
                <More
                    overlay={
                        <>
                            <LemonButton
                                fullWidth
                                onClick={() => {
                                    setSurveyResponse('$survey_response_1', addon.type)
                                    reportSurveyShown(UNSUBSCRIBE_SURVEY_ID, addon.type)
                                }}
                            >
                                Remove add-on
                            </LemonButton>
                        </>
                    }
                />
            </div>
        )
    }

    // If the addon is included with the main product, show the included tag
    if (addon.inclusion_only) {
        return (
            <div className="ml-4 mt-2 self-center flex items-center justify-end gap-x-3 whitespace-nowrap">
                <LemonTag type="completion" icon={<IconCheckCircle />}>
                    Included with plan
                </LemonTag>
            </div>
        )
    }

    // If the addon is not subscribed and not included with the main product, show the add button
    const selectedInterval = currentAndUpgradePlans?.upgradePlan?.intervals?.find((i) => i.interval === interval) || currentAndUpgradePlans?.upgradePlan?.intervals?.[0]
    return (
        <>
            <div className="ml-4 mt-2 self-center flex items-center justify-end gap-x-3 whitespace-nowrap">
                {currentAndUpgradePlans?.upgradePlan?.flat_rate ? (
                    <h4 className="leading-5 font-bold mb-0 space-x-0.5">
                        <span>
                            {currentAndUpgradePlans?.upgradePlan?.intervals ? (
                                formatFlatRate(Number(selectedInterval?.unit_amount_usd), selectedInterval?.interval)
                            ) : (
                                formatFlatRate(Number(upgradePlan?.unit_amount_usd), upgradePlan?.unit)
                            )}
                        </span>
                    </h4>
                ) : (
                    <LemonButton
                        type="secondary"
                        onClick={() => {
                            toggleIsPricingModalOpen()
                        }}
                    >
                        View pricing
                    </LemonButton>
                )}
                <LemonButton
                    type="primary"
                    icon={<IconPlus />}
                    size="small"
                    disableClientSideRouting
                    disabledReason={
                        (billingError && billingError.message) ||
                        (billing?.subscription_level === 'free' && 'Upgrade to add add-ons')
                    }
                    loading={billingProductLoading === addon.type}
                    onClick={() =>
                        initiateProductUpgrade(
                            addon,
                            currentAndUpgradePlans?.upgradePlan,
                            redirectPath
                        )
                    }
                >
                    Add
                </LemonButton>
            </div>
            {/* Note(@zach): this UI implementation only supports two intervals is built to support more if required. */}
            {currentAndUpgradePlans?.upgradePlan?.flat_rate && (
                <div className='mt-2 flex justify-end'>
                    <LemonSwitch
                        label="Switch to annual for a 20% discount"
                        bordered
                        checked={currentAndUpgradePlans?.upgradePlan?.intervals[1].interval === interval}
                        onChange={() => setInterval(currentAndUpgradePlans?.upgradePlan?.intervals[currentAndUpgradePlans?.upgradePlan?.intervals[0].interval === interval ? 1 : 0].interval)}
                    />
                </div>
            )}
            {isProrated && (
                <p className="mt-2 text-xs text-muted text-right">
                    Pay ~${Number(prorationAmount)} today (prorated) and
                    <br />
                    ${Number(upgradePlan?.unit_amount_usd)}/{upgradePlan?.unit} every month thereafter.
                </p>
            )}
        </>
    )
}

export const BillingProductAddon = ({ addon }: { addon: BillingProductV2AddonType }): JSX.Element => {
    const productRef = useRef<HTMLDivElement | null>(null)
    const { billing } = useValues(billingLogic)
    const { isPricingModalOpen, currentAndUpgradePlans, surveyID } = useValues(
        billingProductLogic({ product: addon, productRef })
    )
    const { toggleIsPricingModalOpen } = useActions(billingProductLogic({ product: addon }))

    const productType = { plural: `${addon.unit}s`, singular: addon.unit }
    const tierDisplayOptions: LemonSelectOptions<string> = [
        { label: `Per ${productType.singular}`, value: 'individual' },
    ]

    if (billing?.has_active_subscription) {
        tierDisplayOptions.push({ label: `Current bill`, value: 'total' })
    }

    // Filter out the addon itself from the features list
    const addonFeatures =
        currentAndUpgradePlans?.upgradePlan?.features ||
        currentAndUpgradePlans?.currentPlan?.features ||
        addon.features?.filter((feature) => feature.name !== addon.name)

    const is_enhanced_persons_og_customer =
        addon.type === 'enhanced_persons' &&
        addon.plans?.find((plan) => plan.plan_key === 'addon-20240404-og-customers')

    return (
        <div className="bg-bg-3000 rounded p-6 flex flex-col" ref={productRef}>
            <div className="sm:flex justify-between gap-x-4">
                <div className="flex gap-x-4">
                    {/* Icon column */}
                    <div className="w-8">{getProductIcon(addon.name, addon.icon_key, 'text-2xl')}</div>
                    {/* Main column */}
                    <div>
                        <div className="flex gap-x-2 items-center mt-0 mb-2 ">
                            <h4 className="leading-5 mb-1 font-bold">{addon.name}</h4>
                            {addon.inclusion_only ? (
                                <div className="flex gap-x-2">
                                    <Tooltip title="Automatically included with your plan. Used based on your posthog-js config options.">
                                        <LemonTag type="muted">Config option</LemonTag>
                                    </Tooltip>
                                </div>
                            ) : (
                                addon.subscribed && (
                                    <div>
                                        <LemonTag type="primary" icon={<IconCheckCircle />}>
                                            Subscribed
                                        </LemonTag>
                                    </div>
                                )
                            )}
                        </div>
                        <p className="ml-0 mb-0">
                            {addon.description}{' '}
                            {addon.docs_url && (
                                <>
                                    <Link to={addon.docs_url}>Read the docs</Link> for more information.
                                </>
                            )}
                        </p>
                        {is_enhanced_persons_og_customer && (
                            <p className="mt-2 mb-0">
                                <Link
                                    to="https://posthog.com/changelog/2024#person-profiles-launched-posthog-now-up-to-80percent-cheaper"
                                    className="italic"
                                    target="_blank"
                                    targetBlankIcon
                                >
                                    Why is this here?{' '}
                                </Link>
                            </p>
                        )}
                    </div>
                </div>
                {/* Pricing column */}
                <div className="min-w-64 w-full">
                    <PricingSection addon={addon} productRef={productRef} />
                </div>
            </div>
            {/* Features list */}
            <div className="mt-3 ml-11">
                {addonFeatures?.length > 2 && (
                    <div>
                        <p className="ml-0 mb-2 max-w-200">Features included:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                            {addonFeatures.map((feature, index) => (
                                <div
                                    className="flex gap-x-2 items-center mb-2"
                                    key={'addon-features-' + addon.type + index}
                                >
                                    <IconCheckCircle className="text-success" />
                                    <Tooltip key={feature.key} title={feature.description}>
                                        <b>
                                            {feature.name}
                                            {feature.note ? ': ' + feature.note : ''}
                                        </b>
                                    </Tooltip>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <ProductPricingModal
                modalOpen={isPricingModalOpen}
                onClose={toggleIsPricingModalOpen}
                product={addon}
                planKey={
                    addon.subscribed
                        ? currentAndUpgradePlans?.currentPlan?.plan_key
                        : currentAndUpgradePlans?.upgradePlan?.plan_key
                }
            />
            {surveyID && <UnsubscribeSurveyModal product={addon} />}
        </div>
    )
}
