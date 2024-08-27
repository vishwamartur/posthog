#!/usr/bin/python3

from aggregate_funnel_trends import parse_user_aggregation_with_conversion_window_and_breakdown, parse_args
import sys
import json

if __name__ == "__main__":
    for line in sys.stdin:
        try:
            parse_user_aggregation_with_conversion_window_and_breakdown(*parse_args(line))
        except Exception as e:
            print(json.dumps({"result": json.dumps(str(e))}), end="\n")  # noqa: T201
        sys.stdout.flush()
