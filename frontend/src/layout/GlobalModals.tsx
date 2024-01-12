import { LemonModal } from '@posthog/lemon-ui'
import { useActions, useValues } from 'kea'
import { FlaggedFeature } from 'lib/components/FlaggedFeature'
import { HedgehogBuddyWithLogic } from 'lib/components/HedgehogBuddy/HedgehogBuddyWithLogic'
import { Prompt } from 'lib/logic/newPrompt/Prompt'
import { Setup2FA } from 'scenes/authentication/Setup2FA'
import { CreateOrganizationModal } from 'scenes/organization/CreateOrganizationModal'
import { membersLogic } from 'scenes/organization/membersLogic'
import { CreateProjectModal } from 'scenes/project/CreateProjectModal'
import { SessionPlayerModal } from 'scenes/session-recordings/player/modal/SessionPlayerModal'
import { inviteLogic } from 'scenes/settings/organization/inviteLogic'
import { InviteModal } from 'scenes/settings/organization/InviteModal'
import { UpgradeModal } from 'scenes/UpgradeModal'
import { userLogic } from 'scenes/userLogic'

import { FeaturePreviewsModal } from './FeaturePreviews'
import { globalModalsLogic } from './globalModalsLogic'

export function GlobalModals(): JSX.Element {
    const { isCreateOrganizationModalShown, isCreateProjectModalShown } = useValues(globalModalsLogic)
    const { hideCreateOrganizationModal, hideCreateProjectModal } = useActions(globalModalsLogic)
    const { isInviteModalShown } = useValues(inviteLogic)
    const { hideInviteModal } = useActions(inviteLogic)
    const { user } = useValues(userLogic)

    return (
        <>
            <InviteModal isOpen={isInviteModalShown} onClose={hideInviteModal} />
            <CreateOrganizationModal isVisible={isCreateOrganizationModalShown} onClose={hideCreateOrganizationModal} />
            <CreateProjectModal isVisible={isCreateProjectModalShown} onClose={hideCreateProjectModal} />
            <FeaturePreviewsModal />
            <UpgradeModal />
            <SessionPlayerModal />

            {user && user.organization?.enforce_2fa && !user.is_2fa_enabled && (
                <LemonModal title="Set up 2FA" closable={false}>
                    <p>
                        <b>Your organization requires you to set up 2FA.</b>
                    </p>
                    <p>
                        <b>
                            Use an authenticator app like Google Authenticator or 1Password to scan the QR code below.
                        </b>
                    </p>
                    <Setup2FA
                        onSuccess={() => {
                            userLogic.actions.loadUser()
                            membersLogic.actions.loadMembers()
                        }}
                    />
                </LemonModal>
            )}
            <FlaggedFeature flag="enable-prompts">
                <Prompt />
            </FlaggedFeature>
            <HedgehogBuddyWithLogic />
        </>
    )
}
