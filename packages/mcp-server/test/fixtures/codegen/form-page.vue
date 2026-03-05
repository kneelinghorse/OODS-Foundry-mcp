<template>
  <Stack id="form-page-screen" data-oods-component="Stack">
      <Card id="form-contact-card" data-oods-component="Card">
            <CardHeader id="form-contact-header" data-oods-component="CardHeader" title="Contact Details" />
            <FormLabelGroup id="form-contact-label" data-oods-component="FormLabelGroup" htmlFor="contact-email-input" label="Email" placeholder="owner@company.com" />
            <Input id="form-contact-input" data-oods-component="Input" id="contact-email-input" name="email" placeholder="owner@company.com" type="email" />
            <Select id="form-contact-select" data-oods-component="Select" name="locale" :options="[{'value':'en-US','label':'English (US)'},{'value':'fr-FR','label':'French (FR)'}]" value="en-US" />
          </Card>
      <Card id="form-preferences-card" data-oods-component="Card">
            <CardHeader id="form-preferences-header" data-oods-component="CardHeader" title="Preferences" />
            <Text id="form-preferences-text" data-oods-component="Text" text="Configure delivery and billing preferences." />
            <Input id="form-preferences-input" data-oods-component="Input" name="projectName" placeholder="Project Name" />
            <Select id="form-preferences-select" data-oods-component="Select" name="plan" :options="[{'value':'starter','label':'Starter'},{'value':'pro','label':'Pro'}]" value="pro" />
          </Card>
      <Card id="form-actions-card" data-oods-component="Card">
            <CardHeader id="form-actions-header" data-oods-component="CardHeader" title="Actions" />
            <Button id="form-actions-save" data-oods-component="Button" label="Save Changes" type="submit" />
            <Button id="form-actions-cancel" data-oods-component="Button" label="Cancel" type="button" />
            <Banner id="form-actions-banner" data-oods-component="Banner" message="Unsaved changes will be lost." />
          </Card>
    </Stack>
</template>

<script setup lang="ts">
import { Banner, Button, Card, CardHeader, FormLabelGroup, Input, Select, Stack, Text } from '@oods/components';

defineProps<{
  // Props can be extended here
}>();
</script>
