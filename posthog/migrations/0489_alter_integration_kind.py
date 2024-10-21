# Generated by Django 4.2.15 on 2024-10-15 10:30

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("posthog", "0488_alter_user_is_active"),
    ]

    operations = [
        migrations.AlterField(
            model_name="integration",
            name="kind",
            field=models.CharField(
                choices=[
                    ("slack", "Slack"),
                    ("salesforce", "Salesforce"),
                    ("hubspot", "Hubspot"),
                    ("google-pubsub", "Google Pubsub"),
                    ("google-cloud-storage", "Google Cloud Storage"),
                    ("google-ads", "Google Ads"),
                ],
                max_length=20,
            ),
        ),
    ]
