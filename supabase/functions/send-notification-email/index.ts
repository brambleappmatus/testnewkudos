import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = "https://kudos.lovable.dev"; 

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  type: "kudos" | "reward_status";
  rewardId?: string;
  userId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, type, rewardId, userId }: EmailRequest = await req.json();

    let subject: string;
    let buttonText: string;
    let message: string;

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
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; background: #fff;">
            <p style="font-size: 16px; line-height: 1.5;">${message}</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${APP_URL}/dashboard" 
                 style="background: #8B5CF6; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 5px; 
                        display: inline-block;">
                ${buttonText}
              </a>
            </div>
            <p style="font-size: 14px; color: #666;">
              This is an automated message, please do not reply.
            </p>
          </div>
        </body>
      </html>
    `;

    console.log("Sending email to:", to);
    console.log("Email type:", type);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Kudosky <no-reply@kudosky.com>",
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error('Resend API error:', error);
      throw new Error("Failed to send email");
    }

    // If this is a reward claim, notify admins
    if (type === "reward_status" && rewardId && userId) {
      try {
        await fetch(`${APP_URL}/functions/v1/send-admin-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            rewardId,
            userId,
          }),
        });
      } catch (error) {
        console.error("Error sending admin notification:", error);
      }
    }

    const data = await res.json();
    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-notification-email function:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send email" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);