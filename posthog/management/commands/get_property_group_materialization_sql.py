import argparse
from django.core.management.base import BaseCommand
from posthog.clickhouse.property_groups import property_groups


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument("table")
        parser.add_argument("-p/--partition", nargs="*", dest="partitions", default=None)
        parser.add_argument("--on-cluster", action=argparse.BooleanOptionalAction, dest="on_cluster", default=None)

    def handle(self, *, table, on_cluster, partitions, **options) -> None:
        return "\n".join(
            property_groups.get_materialize_statements(table, partitions=partitions, on_cluster=on_cluster)
        )
