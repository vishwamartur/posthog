# Generated by Django 3.2.12 on 2022-04-08 11:13

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("posthog", "0225_insight_viewed"),
    ]

    operations = [
        migrations.AddField(
            model_name="dashboard",
            name="insights",
            field=models.ManyToManyField(blank=True, related_name="dashboards", to="posthog.Insight"),
        ),
        migrations.AddField(
            model_name="insight", name="dashboard_insight_filters_hash", field=models.JSONField(default=dict),
        ),
    ]
