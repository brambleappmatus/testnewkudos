import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured')
      throw new Error('RESEND_API_KEY is not configured')
    }

    const { userId, status, adminNotes } = await req.json()
    console.log('Received request:', { userId, status, adminNotes })

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('user_id', userId)
      .single()

    if (profileError || !profile?.email) {
      console.error('Profile error:', profileError)
      throw new Error('Could not find user email')
    }

    const statusText = status === 'confirmed' ? 'approved' : 'declined'
    const subject = `Your reward claim has been ${statusText}`
    const notesText = adminNotes ? `<p style="color: #666666; font-size: 16px; line-height: 24px; margin: 16px 0; padding: 0 48px; text-align: center;">${adminNotes}</p>` : ''

    // Create HTML email template with improved structure
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; margin: 0; padding: 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td align="center">
                <table width="100%" style="max-width: 600px;" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 48px 0;">
                      <h1 style="color: #333333; font-size: 24px; font-weight: 600; line-height: 1.5; margin: 0 0 24px; padding: 0 48px; text-align: left;">
                        Hello ${profile.first_name || 'there'},
                      </h1>
                      <p style="color: #333333; font-size: 16px; line-height: 24px; margin: 16px 0; padding: 0 48px; text-align: center;">
                        Your reward claim has been ${statusText}.
                      </p>
                      ${notesText}
                      <div style="text-align: center; margin: 32px 0;">
                        <a href="https://kudosky.com/rewards" 
                           style="background-color: #8B5CF6; border-radius: 8px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: 600; line-height: 50px; text-align: center; text-decoration: none; width: 200px;">
                          View Details
                        </a>
                      </div>
                      <p style="color: #666666; font-size: 14px; line-height: 24px; margin: 32px 0 0; padding: 0 48px; text-align: center;">
                        This is an automated message, please do not reply.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `

    console.log('Sending email to:', profile.email)

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Kudosky <no-reply@kudosky.com>',
        to: [profile.email],
        subject: subject,
        html: html,
      }),
    })

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text()
      console.error('Resend API error:', errorText)
      throw new Error(`Failed to send email: ${errorText}`)
    }

    const emailData = await emailResponse.json()
    console.log('Email sent successfully:', emailData)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in send-reward-status-email function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})