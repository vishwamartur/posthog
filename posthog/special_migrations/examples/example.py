from ee.clickhouse.client import sync_execute
from ee.clickhouse.sql.person import (
    KAFKA_PERSONS_DISTINCT_ID_TABLE_SQL,
    PERSONS_DISTINCT_ID_TABLE,
    PERSONS_DISTINCT_ID_TABLE_MV_SQL,
    PERSONS_DISTINCT_ID_TABLE_SQL,
)
from posthog.constants import AnalyticsDBMS
from posthog.settings import CLICKHOUSE_CLUSTER, CLICKHOUSE_DATABASE
from posthog.special_migrations.definition import SpecialMigrationDefinition, SpecialMigrationOperation
from posthog.version_requirement import ServiceVersionRequirement

ONE_DAY = 60 * 60 * 24

TEMPORARY_TABLE_NAME = "person_distinct_id_special_migration"


class Migration(SpecialMigrationDefinition):

    description = "An example special migration."

    posthog_min_version = "1.29.0"
    posthog_max_version = "1.30.0"

    service_version_requirements = [
        ServiceVersionRequirement(service="clickhouse", supported_version=">=21.6.0,<21.7.0"),
    ]

    # ideas:
    # 1. support functions as operations instead of just sql?
    #   1.1. receive the output of the previous op?
    operations = [
        SpecialMigrationOperation(
            database=AnalyticsDBMS.CLICKHOUSE,
            sql=PERSONS_DISTINCT_ID_TABLE_SQL.replace(PERSONS_DISTINCT_ID_TABLE, TEMPORARY_TABLE_NAME, 1),
            rollback=f"DROP TABLE IF EXISTS {TEMPORARY_TABLE_NAME} ON CLUSTER {CLICKHOUSE_CLUSTER}",
        ),
        SpecialMigrationOperation(
            database=AnalyticsDBMS.CLICKHOUSE,
            sql=f"DROP TABLE person_distinct_id_mv ON CLUSTER {CLICKHOUSE_CLUSTER}",
            rollback=PERSONS_DISTINCT_ID_TABLE_MV_SQL,
        ),
        SpecialMigrationOperation(
            database=AnalyticsDBMS.CLICKHOUSE,
            sql=f"DROP TABLE kafka_person_distinct_id ON CLUSTER {CLICKHOUSE_CLUSTER}",
            rollback=KAFKA_PERSONS_DISTINCT_ID_TABLE_SQL,
        ),
        SpecialMigrationOperation(
            database=AnalyticsDBMS.CLICKHOUSE,
            timeout_seconds=ONE_DAY,
            sql=f"""
                INSERT INTO {TEMPORARY_TABLE_NAME} (distinct_id, person_id, team_id, _sign, _timestamp, _offset)
                SELECT
                    distinct_id,
                    person_id,
                    team_id,
                    if(is_deleted==0, 1, -1) as _sign,
                    _timestamp,
                    _offset
                FROM {PERSONS_DISTINCT_ID_TABLE}
            """,
            rollback="DROP TABLE IF EXISTS person_distinct_id_failed",
        ),
        SpecialMigrationOperation(
            database=AnalyticsDBMS.CLICKHOUSE,
            sql=f"""
                RENAME TABLE
                    {CLICKHOUSE_DATABASE}.{PERSONS_DISTINCT_ID_TABLE} to {CLICKHOUSE_DATABASE}.person_distinct_id_backup,
                    {CLICKHOUSE_DATABASE}.{TEMPORARY_TABLE_NAME} to {CLICKHOUSE_DATABASE}.{PERSONS_DISTINCT_ID_TABLE}
                ON CLUSTER {CLICKHOUSE_CLUSTER}
            """,
            rollback=f"""
                RENAME TABLE
                    {CLICKHOUSE_DATABASE}.{TEMPORARY_TABLE_NAME} to {CLICKHOUSE_DATABASE}.person_distinct_id_failed,
                    {CLICKHOUSE_DATABASE}.{PERSONS_DISTINCT_ID_TABLE} to {CLICKHOUSE_DATABASE}.{TEMPORARY_TABLE_NAME}
                ON CLUSTER {CLICKHOUSE_CLUSTER}
            """,
        ),
        SpecialMigrationOperation(
            database=AnalyticsDBMS.CLICKHOUSE,
            sql=KAFKA_PERSONS_DISTINCT_ID_TABLE_SQL,
            rollback=f"DROP TABLE kafka_person_distinct_id ON CLUSTER {CLICKHOUSE_CLUSTER}",
        ),
        SpecialMigrationOperation(
            database=AnalyticsDBMS.CLICKHOUSE,
            sql=PERSONS_DISTINCT_ID_TABLE_MV_SQL,
            rollback=f"DROP TABLE person_distinct_id_mv ON CLUSTER {CLICKHOUSE_CLUSTER}",
        ),
    ]

    def healthcheck(self):
        result = sync_execute("SELECT total_space, free_space FROM system.disks")
        total_space = result[0][0]
        free_space = result[0][1]
        if free_space > total_space / 3:
            return (True, None)
        else:
            return (False, "Upgrade your ClickHouse storage.")

    def progress(self, _):
        result = sync_execute(f"SELECT COUNT(1) FROM {TEMPORARY_TABLE_NAME}")
        result2 = sync_execute(f"SELECT COUNT(1) FROM {PERSONS_DISTINCT_ID_TABLE}")
        total_events_to_move = result2[0][0]
        total_events_moved = result[0][0]

        progress = 100 * total_events_moved / total_events_to_move
        return progress
