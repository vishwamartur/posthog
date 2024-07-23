import datetime

import structlog
from celery import shared_task

from posthog.warehouse.data_load.service import (
    cancel_external_data_workflow,
    pause_external_data_schedule,
    unpause_external_data_schedule,
)
from posthog.warehouse.models import ExternalDataJob, ExternalDataSource
from posthog.ph_client import get_ph_client
from posthog.models import Team
from django.db.models import Q

logger = structlog.get_logger(__name__)

MONTHLY_LIMIT = 500_000_000

# TODO: adjust to whenever billing officially starts
DEFAULT_DATE_TIME = datetime.datetime(2024, 6, 1, tzinfo=datetime.UTC)


def capture_external_data_rows_synced() -> None:
    # the teams that are not demo and not internal metrics of existing sources
    team_ids = ExternalDataSource.objects.filter(
        ~Q(team__is_demo=True) & ~Q(team__organization__for_internal_metrics=True)
    ).values_list("team", flat=True)
    for team_id in team_ids:
        capture_workspace_rows_synced_by_team.delay(team_id)


def check_synced_row_limits() -> None:
    team_ids = ExternalDataSource.objects.values_list("team", flat=True)
    for team_id in team_ids:
        check_synced_row_limits_of_team.delay(team_id)


@shared_task(ignore_result=True)
def check_synced_row_limits_of_team(team_id: int) -> None:
    logger.info("Checking synced row limits of team", team_id=team_id)

    from ee.billing.quota_limiting import list_limited_team_attributes, QuotaResource, QuotaLimitingCaches

    limited_teams_rows_synced = list_limited_team_attributes(
        QuotaResource.ROWS_SYNCED, QuotaLimitingCaches.QUOTA_LIMITER_CACHE_KEY
    )

    if team_id in limited_teams_rows_synced:
        running_jobs = ExternalDataJob.objects.filter(team_id=team_id, status=ExternalDataJob.Status.RUNNING)
        for job in running_jobs:
            try:
                cancel_external_data_workflow(job.workflow_id)
            except Exception as e:
                logger.exception("Could not cancel external data workflow", exc_info=e)

            try:
                pause_external_data_schedule(str(job.pipeline.id))
            except Exception as e:
                logger.exception("Could not pause external data schedule", exc_info=e)

            job.status = ExternalDataJob.Status.CANCELLED
            job.save()

            job.pipeline.status = ExternalDataSource.Status.PAUSED
            job.pipeline.save()
    else:
        all_sources = ExternalDataSource.objects.filter(team_id=team_id, status=ExternalDataSource.Status.PAUSED)
        for source in all_sources:
            try:
                unpause_external_data_schedule(str(source.id))
            except Exception as e:
                logger.exception("Could not unpause external data schedule", exc_info=e)

            source.status = ExternalDataSource.Status.COMPLETED
            source.save()


@shared_task(ignore_result=True)
def capture_workspace_rows_synced_by_team(team_id: int) -> None:
    ph_client = get_ph_client()
    team = Team.objects.get(pk=team_id)
    now = datetime.datetime.now(datetime.UTC)
    begin = team.external_data_workspace_last_synced_at or DEFAULT_DATE_TIME

    team.external_data_workspace_last_synced_at = now

    for job in ExternalDataJob.objects.filter(team_id=team_id, created_at__gte=begin).order_by("created_at").all():
        ph_client.capture(
            team_id,
            "$data_sync_job_completed",
            {
                "team_id": team_id,
                "workspace_id": team.external_data_workspace_id,
                "count": job.rows_synced,
                "start_time": job.created_at,
                "job_id": str(job.pk),
            },
        )

        team.external_data_workspace_last_synced_at = job.created_at

    team.save()

    ph_client.shutdown()
