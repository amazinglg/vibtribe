import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import {
  SITE_NAME, SITE_URL, LOGO_URL, SUPPORT_EMAIL,
  main, container, card, logo, eyebrow, h1, text, muted, button, legalBlock, footer,
} from './_shared'

interface Props { name?: string }

const OffboardingIncomplete = ({ name }: Props) => {
  const first = (name || 'there').split(' ')[0]
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your incomplete {SITE_NAME} account has been removed.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Img src={LOGO_URL} width="52" height="52" alt={SITE_NAME} style={logo} />
            <Text style={eyebrow}>Account update</Text>
            <Heading style={h1}>We’ve closed your unfinished {SITE_NAME} account</Heading>
            <Text style={text}>Hi {first},</Text>
            <Text style={text}>
              We noticed you started creating a {SITE_NAME} account but didn’t
              finish the sign-up process within the permitted timeframe. To keep
              the platform tidy and secure, incomplete accounts are removed
              after repeated reminders.
            </Text>
            <Text style={text}>
              No hard feelings — you’re welcome to start fresh whenever you’re
              ready. It only takes a minute.
            </Text>
            <Button style={button} href={`${SITE_URL}/sign-up`}>
              Create a new account
            </Button>
            <Text style={legalBlock as any}>
              <strong>About your data.</strong> Your personal data will be
              deleted or retained in accordance with applicable law (including
              the Digital Personal Data Protection Act, 2023), our{' '}
              <a href={`${SITE_URL}/privacy`} style={{ color: '#6366f1' }}>Privacy Policy</a>,
              and our legal obligations relating to security, fraud prevention,
              dispute resolution, and regulatory compliance.
            </Text>
            <Text style={muted}>
              Questions? Reach us at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#6366f1' }}>{SUPPORT_EMAIL}</a>.
            </Text>
            <Text style={footer}>— The {SITE_NAME} Team</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OffboardingIncomplete,
  subject: `Your incomplete ${SITE_NAME} account has been removed`,
  displayName: 'Offboarding — Incomplete signup',
  previewData: { name: 'Sam' },
} satisfies TemplateEntry