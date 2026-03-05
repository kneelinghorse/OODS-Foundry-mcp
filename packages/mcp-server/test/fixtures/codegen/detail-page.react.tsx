import React from 'react';
import { ArchiveSummary, Card, DetailHeader, OwnershipSummary, Stack, StatusTimeline, TagSummary } from '@oods/components';

type ArchiveSummaryProps = React.ComponentPropsWithoutRef<typeof ArchiveSummary>;
type CardProps = React.ComponentPropsWithoutRef<typeof Card>;
type DetailHeaderProps = React.ComponentPropsWithoutRef<typeof DetailHeader>;
type OwnershipSummaryProps = React.ComponentPropsWithoutRef<typeof OwnershipSummary>;
type StackProps = React.ComponentPropsWithoutRef<typeof Stack>;
type StatusTimelineProps = React.ComponentPropsWithoutRef<typeof StatusTimeline>;
type TagSummaryProps = React.ComponentPropsWithoutRef<typeof TagSummary>;

export const GeneratedUI: React.FC = () => {
  return (
    <>
      <Stack id="detail-page-screen" data-oods-component="Stack">
            <Card id="detail-card" data-oods-component="Card" data-layout="sidebar" style={{ alignItems: 'start', display: 'grid', gap: 'var(--ref-spacing-lg)', gridTemplateColumns: 'minmax(0, 1fr) minmax(16rem, 24rem)' }}>
                    <div data-sidebar-main>
                      <Stack id="detail-main-stack" data-oods-component="Stack">
                                  <DetailHeader id="detail-header" data-oods-component="DetailHeader" status="Active" subtitle="Enterprise" title="Account 2049" />
                                  <OwnershipSummary id="detail-ownership" data-oods-component="OwnershipSummary" owner="Renee Li" team="Customer Ops" />
                                  <TagSummary id="detail-tags" data-oods-component="TagSummary" tags={["priority","enterprise","renewal"]} />
                                </Stack>
                    </div>
                    <aside data-sidebar-aside>
                      <Stack id="detail-aside-stack" data-oods-component="Stack">
                                  <StatusTimeline id="detail-status-timeline" data-oods-component="StatusTimeline" steps={[{"id":"lead","label":"Lead","state":"complete"},{"id":"trial","label":"Trial","state":"current"},{"id":"contract","label":"Contract","state":"upcoming"}]} />
                                  <ArchiveSummary id="detail-archive-summary" data-oods-component="ArchiveSummary" lastUpdated="2026-02-24" status="Active" />
                                </Stack>
                    </aside>
                  </Card>
          </Stack>
    </>
  );
};
