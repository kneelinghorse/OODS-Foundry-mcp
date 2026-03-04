<template>
  <Stack id="detail-page-screen" data-oods-component="Stack">
      <Card id="detail-card" data-oods-component="Card" data-layout="sidebar" style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(16rem, 24rem); align-items: start; gap: var(--ref-spacing-lg)">
            <div data-sidebar-main>
              <Stack id="detail-main-stack" data-oods-component="Stack">
                        <DetailHeader id="detail-header" data-oods-component="DetailHeader" title="Account 2049" subtitle="Enterprise" status="Active" />
                        <OwnershipSummary id="detail-ownership" data-oods-component="OwnershipSummary" owner="Renee Li" team="Customer Ops" />
                        <TagSummary id="detail-tags" data-oods-component="TagSummary" :tags="['priority','enterprise','renewal']" />
                      </Stack>
            </div>
            <aside data-sidebar-aside>
              <Stack id="detail-aside-stack" data-oods-component="Stack">
                        <StatusTimeline id="detail-status-timeline" data-oods-component="StatusTimeline" :steps="[{'id':'lead','label':'Lead','state':'complete'},{'id':'trial','label':'Trial','state':'current'},{'id':'contract','label':'Contract','state':'upcoming'}]" />
                        <ArchiveSummary id="detail-archive-summary" data-oods-component="ArchiveSummary" status="Active" lastUpdated="2026-02-24" />
                      </Stack>
            </aside>
          </Card>
    </Stack>
</template>

<script setup lang="ts">
import { ArchiveSummary, Card, DetailHeader, OwnershipSummary, Stack, StatusTimeline, TagSummary } from '@oods/components';

defineProps<{
  // Props can be extended here
}>();
</script>

<style scoped>
/* Token CSS variables are consumed via inline styles. */
/* Add component-scoped overrides here as needed. */
</style>
