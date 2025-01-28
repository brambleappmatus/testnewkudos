import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from 'npm:resend';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AdminNotificationPayload {
  rewardId: string;
  userId: string;
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(RESEND_API_KEY);

const handler = async (req: Request): Promise<Response> => {
  console.log("Admin notification function triggered");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rewardId, userId }: AdminNotificationPayload = await req.json();
    console.log("Processing admin notification for reward:", rewardId, "claimed by user:", userId);

    // Get reward details with company information
    const { data: reward, error: rewardError } = await supabase
      .from("rewards")
      .select(`
        *,
        company:companies(*)
      `)
      .eq("id", rewardId)
      .single();

    if (rewardError || !reward) {
      console.error("Error fetching reward:", rewardError);
      throw new Error("Reward not found");
    }

    // Get user profile
    const { data: userProfile, error: userError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (userError || !userProfile) {
      console.error("Error fetching user profile:", userError);
      throw new Error("User profile not found");
    }

    // Get company admins
    const { data: admins, error: adminsError } = await supabase
      .from("company_members")
      .select(`
        *,
        profiles(*)
      `)
      .eq("company_id", reward.company_id)
      .eq("role", "company_admin");

    if (adminsError) {
      console.error("Error fetching admins:", adminsError);
      throw new Error("Failed to fetch company admins");
    }

    console.log("Found admins:", admins);

    // Send email to each admin
    for (const admin of admins) {
      if (!admin.profiles?.email) continue;

      const html = `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; background: #fff;">
              <h2 style="color: #6B46C1;">New Reward Claim</h2>
              <p>Hello,</p>
              <p>A new reward has been claimed in your company:</p>
              <div style="background: #F9FAFB; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p><strong>Reward:</strong> ${reward.name}</p>
                <p><strong>Claimed by:</strong> ${userProfile.first_name} ${userProfile.last_name}</p>
                <p><strong>Points cost:</strong> ${reward.points_cost}</p>
              </div>
              <p>Please review this claim in your admin dashboard.</p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="https://kudosky.com/admin/rewards" 
                   style="background: #8B5CF6; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; 
                          display: inline-block;">
                  Review Claim
                </a>
              </div>
              <p style="color: #6B7280; font-size: 14px;">
                This is an automated message, please do not reply.
              </p>
            </div>
          </body>
        </html>
      `;

      console.log("Sending email to admin:", admin.profiles.email);

      const { data, error: sendError } = await resend.emails.send({
        from: 'Kudosky <no-reply@kudosky.com>',
        to: [admin.profiles.email],
        subject: "New Reward Claim",
        html: html,
      });

      if (sendError) {
        console.error("Error sending email to admin:", sendError);
      } else {
        console.log("Email sent successfully to admin:", data);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-admin-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);