import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  type: "kudos" | "reward_status";
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting email send process");
    
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not set");
      throw new Error("Email service is not configured");
    }

    const { to, type }: EmailRequest = await req.json();
    console.log("Received request to send email to:", to);
    console.log("Email type:", type);

    let subject: string;
    let buttonText: string;
    let message: string;
    // Generate a shorter unique ID (last 4 digits of timestamp + random number)
    const uniqueId = `${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 1000)}`;

    if (type === "kudos") {
      subject = "New Kudos Received! 🌟";
      buttonText = "View Your Kudos";
      message = "Someone has sent you kudos! Click below to see who and what they said.";
    } else {
      subject = "Reward Status Update 🎁";
      buttonText = "Check Status";
      message = "There's been an update to one of your rewards. Click below to see the details.";
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; background-color: #f6f9fc;">
          <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px;">
            <h1 style="color: #333; font-size: 24px; margin-bottom: 24px;">${subject}</h1>
            <p style="font-size: 16px; line-height: 1.5; margin-bottom: 32px;">${message}</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="https://kudosky.com/dashboard" 
                 style="background: #8B5CF6; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 5px; 
                        display: inline-block;
                        font-weight: 600;">
                ${buttonText}
              </a>
            </div>
            <p style="font-size: 14px; color: #666; margin-top: 32px; text-align: center;">
              This is an automated message, please do not reply.
            </p>
          </div>
        </body>
      </html>
    `;

    // Implement retry logic
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt} to send email`);
        
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Kudosky <no-reply@kudosky.com>",
            to: [to],
            subject: `${subject} #${uniqueId}`,
            html,
            headers: {
              "X-Entity-Ref-ID": `${type}-${uniqueId}`,
              "List-Unsubscribe": "<mailto:unsubscribe@kudosky.com>",
              "Precedence": "bulk"
            }
          }),
        });

        if (res.ok) {
          const data = await res.json();
          console.log("Email sent successfully:", data);
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        lastError = await res.text();
        console.error(`Attempt ${attempt} failed:`, lastError);
        
        // If we haven't reached max retries, wait before trying again
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt} failed with error:`, error);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
    }

    // If we get here, all retries failed
    throw new Error(`Failed to send email after ${maxRetries} attempts. Last error: ${lastError}`);

  } catch (error) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);