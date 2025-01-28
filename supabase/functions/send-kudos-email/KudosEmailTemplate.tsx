import React from 'https://esm.sh/react@18.2.0';
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'https://esm.sh/@react-email/components';

interface KudosEmailTemplateProps {
  firstName?: string;
  message: string;
  buttonText: string;
}

export const KudosEmailTemplate = ({
  firstName = 'there',
  message,
  buttonText,
}: KudosEmailTemplateProps) => {
  return (
    <Html>
      <Head />
      <Preview>You have a new notification from Kudosky</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Hi {firstName},</Heading>
          <Text style={text}>{message}</Text>
          <Link
            href="https://kudosky.com/dashboard"
            style={button}
            target="_blank"
          >
            {buttonText}
          </Link>
          <Text style={footer}>
            This is an automated message, please do not reply.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.5',
  margin: '16px 0',
  padding: '0 48px',
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
  padding: '0 48px',
};

const button = {
  backgroundColor: '#8B5CF6',
  borderRadius: '5px',
  color: '#fff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '50px',
  textAlign: 'center' as const,
  textDecoration: 'none',
  width: '200px',
  margin: '16px 48px',
};

const footer = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '16px 0',
  padding: '0 48px',
};

export default KudosEmailTemplate;