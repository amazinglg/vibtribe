import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'VibTribe'
const LOGO_URL = 'https://www.vibtribe.in/icons/icon-192x192.png'

interface Props {
  consentUrl?: string
  minorName?: string
  guardianName?: string
  relationship?: string
}

const GuardianConsentRequestEmail = ({
  consentUrl = 'https://www.vibtribe.in/guardian-consent/token',
  minorName = 'a young user',
  guardianName,
  relationship = 'guardian',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{minorName} needs your consent to use {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="56" height="56" alt={SITE_NAME} style={logo} />
        <Heading style={h1}>Consent request for {minorName}</Heading>
        <Text style={text}>
          {guardianName ? `Hi ${guardianName},` : 'Hi there,'} {minorName} has signed up to
          {' '}{SITE_NAME} and listed you as their {relationship}. Under India's Digital Personal
          Data Protection Act (DPDP), 2023, we need your verifiable consent before {minorName} can
          chat, post or use age-restricted features.
        </Text>
        <Text style={text}>
          Please review and confirm your consent using the button below:
        </Text>
        <Section style={{ textAlign: 'center' as const, margin: '8px 0 24px' }}>
          <Button href={consentUrl} style={button}>Review consent request</Button>
        </Section>
        <Text style={smallText}>
          If the button doesn't work, copy this link into your browser:
          <br />
          <a href={consentUrl} style={{ color: '#7c3aed', wordBreak: 'break-all' }}>{consentUrl}</a>
        </Text>
        <Text style={smallText}>
          You can withdraw consent at any time. Consent is only valid until {minorName} turns 18,
          after which it is automatically retired.
        </Text>
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: GuardianConsentRequestEmail,
  subject: (data: Record<string, any>) =>
    `Consent needed: ${data?.minorName || 'A young user'} wants to use ${SITE_NAME}`,
  displayName: 'Guardian consent request',
  previewData: {
    consentUrl: 'https://www.vibtribe.in/guardian-consent/abc123',
    minorName: 'Aarav',
    guardianName: 'Priya',
    relationship: 'parent',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '520px' }
const logo = { borderRadius: '12px', marginBottom: '20px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0a0a0f', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.55', margin: '0 0 20px' }
const smallText = { fontSize: '12px', color: '#77797f', lineHeight: '1.55', margin: '0 0 16px' }
const button = {
  backgroundColor: '#7c3aed',
  color: '#ffffff',
  padding: '12px 22px',
  borderRadius: '10px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }