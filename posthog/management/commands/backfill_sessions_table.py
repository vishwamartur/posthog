from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import structlog
from django.core.management.base import BaseCommand

from posthog.clickhouse.client.connection import Workload
from posthog.clickhouse.client.execute import sync_execute
from datetime import datetime, timedelta

from posthog.models.sessions.sql import get_session_table_mv_select_sql

logger = structlog.get_logger(__name__)

TARGET_TABLE = "sessions"

SETTINGS = {
    "max_execution_time": 3600  # 1 hour
}


@dataclass
class BackfillQuery:
    start_date: datetime
    end_date: datetime
    use_offline_workload: bool

    def execute(
        self,
        dry_run: bool = True,
        print_counts: bool = True,
    ) -> None:
        num_days = (self.end_date - self.start_date).days + 1

        logger.info(
            f"Backfilling sessions table from {self.start_date.strftime('%Y-%m-%d')} to {self.end_date.strftime('%Y-%m-%d')}, total numbers of days to insert: {num_days}"
        )

        def select_query(select_date: Optional[datetime] = None) -> str:
            if select_date:
                where = f"toStartOfDay(timestamp) = '{select_date.strftime('%Y-%m-%d')}'"
            else:
                where = "true"

            return get_session_table_mv_select_sql(source_column_mode="json_or_mat", extra_where=where)

        # print the count of entries in the main sessions table
        if print_counts:
            count_query = f"SELECT count(), uniq(session_id) FROM {TARGET_TABLE}"
            [(sessions_row_count, sessions_event_count)] = sync_execute(count_query, settings=SETTINGS)
            logger.info(f"{sessions_row_count} rows and {sessions_event_count} unique session_ids in sessions table")

        if dry_run:
            count_query = f"SELECT count(), uniq(session_id) FROM ({select_query()})"
            [(events_count, sessions_count)] = sync_execute(count_query, settings=SETTINGS)
            logger.info(f"{events_count} events and {sessions_count} sessions to backfill for")
            logger.info(f"The first select query would be:\n{select_query(self.start_date)}")
            return

        for i in range(num_days):
            date = self.start_date + timedelta(days=i)
            logging.info("Writing the sessions for day %s", date.strftime("%Y-%m-%d"))
            sync_execute(
                query=f"""INSERT INTO writable_sessions {select_query(select_date=date)} SETTINGS max_execution_time=3600""",
                workload=Workload.OFFLINE if self.use_offline_workload else Workload.DEFAULT,
                settings=SETTINGS,
            )

        # print the count of entries in the main sessions table
        if print_counts:
            count_query = f"SELECT count(), uniq(session_id) FROM {TARGET_TABLE}"
            [(sessions_row_count, sessions_event_count)] = sync_execute(count_query, settings=SETTINGS)
            logger.info(f"{sessions_row_count} rows and {sessions_event_count} unique session_ids in sessions table")


class Command(BaseCommand):
    help = "Backfill person_distinct_id_overrides records."

    def add_arguments(self, parser):
        parser.add_argument(
            "--start-date", required=True, type=str, help="first day to run backfill on (format YYYY-MM-DD)"
        )
        parser.add_argument(
            "--end-date", required=True, type=str, help="last day to run backfill, inclusive, on (format YYYY-MM-DD)"
        )
        parser.add_argument(
            "--live-run", action="store_true", help="actually execute INSERT queries (default is dry-run)"
        )
        parser.add_argument(
            "--use-offline-workload", action="store_true", help="actually execute INSERT queries (default is dry-run)"
        )
        parser.add_argument(
            "--print-counts", action="store_true", help="print events and session count beforehand and afterwards"
        )

    def handle(
        self,
        *,
        live_run: bool,
        start_date: str,
        end_date: str,
        use_offline_workload: bool,
        print_counts: bool,
        **options,
    ):
        logger.setLevel(logging.INFO)

        start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
        end_datetime = datetime.strptime(end_date, "%Y-%m-%d")

        BackfillQuery(start_datetime, end_datetime, use_offline_workload).execute(
            dry_run=not live_run, print_counts=print_counts
        )
