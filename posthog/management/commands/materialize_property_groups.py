import structlog

from django.core.management.base import BaseCommand
from posthog.clickhouse.property_groups import property_groups
from posthog.clickhouse.client.connection import ch_pool, make_ch_pool


logger = structlog.get_logger(__name__)


def get_pools_for_shards():
    shard_pools = {}

    with ch_pool.get_client() as client:
        rows = client.execute(
            """
            SELECT shard_num, host_address port
            FROM system.clusters
            WHERE cluster = %(cluster)s
            ORDER BY shard_num, replica_num
            LIMIT 1 by shard_num
        """,
            {"cluster": "posthog"},
        )

        for shard_num, host_address in rows:
            # NOTE: We don't actually _need_ a pool, but it's easy to set up here with the standard options.
            shard_pools[shard_num] = make_ch_pool(host=host_address)

    return shard_pools


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument("table")
        parser.add_argument("-p/--partition", action="append", dest="partitions", default=None)

    def handle(self, *, table, partitions, **options) -> None:
        shard_pools = get_pools_for_shards()
        for mutation in property_groups.get_materialization_mutations(table, partitions=partitions):
            logger.info("Queueing %s on all shards...", mutation)
            for shard_num, shard_pool in shard_pools.items():
                with shard_pool.get_client() as client:
                    logger.debug("Queueing %s on shard %s...", mutation, shard_num)
                    client.execute(str(mutation))
                    # TODO: Would be preferable to isolate this by database if possible
                    [(mutation_id,)] = client.execute(
                        """
                        SELECT mutation_id
                        FROM system.mutations
                        WHERE table = %(table)s AND command = %(command)s
                        ORDER BY create_time DESC
                        LIMIT 1
                        """,
                        {"table": mutation.table, "command": mutation.command},
                    )
                    logger.info("Mutation queued on shard %s.", shard_num, mutation_id=mutation_id)
