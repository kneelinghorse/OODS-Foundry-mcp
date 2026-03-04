import React from 'react';
import { Badge, Banner, Button, Card, CardHeader, Input, RoleBadgeList, Select, Stack, Table, Tabs, Text } from '@oods/components';

type BadgeProps = React.ComponentPropsWithoutRef<typeof Badge>;
type BannerProps = React.ComponentPropsWithoutRef<typeof Banner>;
type ButtonProps = React.ComponentPropsWithoutRef<typeof Button>;
type CardProps = React.ComponentPropsWithoutRef<typeof Card>;
type CardHeaderProps = React.ComponentPropsWithoutRef<typeof CardHeader>;
type InputProps = React.ComponentPropsWithoutRef<typeof Input>;
type RoleBadgeListProps = React.ComponentPropsWithoutRef<typeof RoleBadgeList>;
type SelectProps = React.ComponentPropsWithoutRef<typeof Select>;
type StackProps = React.ComponentPropsWithoutRef<typeof Stack>;
type TableProps = React.ComponentPropsWithoutRef<typeof Table>;
type TabsProps = React.ComponentPropsWithoutRef<typeof Tabs>;
type TextProps = React.ComponentPropsWithoutRef<typeof Text>;

export const GeneratedUI: React.FC = () => {
  return (
    <>
      <Stack id="dashboard-screen" data-oods-component="Stack">
            <Card id="dashboard-overview-card" data-oods-component="Card">
                    <CardHeader id="dashboard-overview-header" data-oods-component="CardHeader" title="Overview" supporting="Live KPI" />
                    <Badge id="dashboard-overview-status" data-oods-component="Badge" label="Stable" />
                    <Text id="dashboard-overview-text" data-oods-component="Text" text="Revenue up 12%" />
                    <Button id="dashboard-overview-action" data-oods-component="Button" label="View details" />
                  </Card>
            <Card id="dashboard-activity-card" data-oods-component="Card">
                    <CardHeader id="dashboard-activity-header" data-oods-component="CardHeader" title="Activity" />
                    <Table id="dashboard-activity-table" data-oods-component="Table" columns={[{"key":"event","label":"Event"},{"key":"time","label":"Time"}]} rows={[{"event":"Invoice paid","time":"2m ago"},{"event":"Seat added","time":"10m ago"}]} />
                    <Banner id="dashboard-activity-banner" data-oods-component="Banner" message="No alerts" />
                    <Tabs id="dashboard-activity-tabs" data-oods-component="Tabs" tabs={[{"id":"recent","label":"Recent","content":"24 events","active":true},{"id":"all","label":"All","content":"128 events","active":false}]} />
                  </Card>
            <Card id="dashboard-insights-card" data-oods-component="Card">
                    <CardHeader id="dashboard-insights-header" data-oods-component="CardHeader" title="Insights" />
                    <Input id="dashboard-insights-input" data-oods-component="Input" name="query" placeholder="Search insights" />
                    <Select id="dashboard-insights-select" data-oods-component="Select" name="range" value="7d" options={[{"value":"24h","label":"Last 24h"},{"value":"7d","label":"Last 7d"}]} />
                    <RoleBadgeList id="dashboard-insights-role" data-oods-component="RoleBadgeList" roles={["analyst","owner"]} />
                  </Card>
          </Stack>
    </>
  );
};
