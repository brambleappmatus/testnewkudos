import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from 'npm:resend';
import { renderAsync } from 'npm:@react-email/render';
import { KudosEmailTemplate } from "./KudosEmailTemplate.tsx";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface KudosEmailPayload {
  kudosId: string;
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(RESEND_API_KEY);

const handler = async (req: Request): Promise<Response> => {
  console.log("Kudos email function triggered");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { kudosId }: KudosEmailPayload = await req.json();
    console.log("Processing kudos email for kudos ID:", kudosId);

    // Get kudos details with sender and receiver information
    const { data: kudos, error: kudosError } = await supabase
      .from("kudos")
      .select(`
        *,
        sender:sender_id(
          profiles:profiles(*)
        ),
        receiver:receiver_id(
          profiles:profiles(*)
        )
      `)
      .eq("id", kudosId)
      .single();

    if (kudosError || !kudos) {
      console.error("Error fetching kudos:", kudosError);
      throw new Error("Kudos not found");
    }

    console.log("Found kudos:", kudos);

    const receiverEmail = kudos.receiver?.profiles?.email;
    const receiverName = kudos.receiver?.profiles?.first_name;
    const senderName = kudos.sender?.profiles?.first_name 
      ? `${kudos.sender.profiles.first_name} ${kudos.sender.profiles.last_name || ''}`
      : 'Someone';

    if (!receiverEmail) {
      console.error("Receiver email not found");
      throw new Error("Receiver email not found");
    }

    const message = kudos.message || "You received kudos!";
    
    // Render the React email template to HTML
    const html = await renderAsync(
      KudosEmailTemplate({
        firstName: receiverName || 'there',
        message: `${senderName} sent you kudos: ${message}`,
        buttonText: "View Your Kudos",
      })
    );

    console.log("Preparing to send email to:", receiverEmail);

    const { data, error: sendError } = await resend.emails.send({
      from: 'Kudosky <no-reply@kudosky.com>',
      to: [receiverEmail],
      subject: "New Kudos Received! 🌟",
      html: html,
    });

    if (sendError) {
      console.error("Error sending email:", sendError);
      throw sendError;
    }

    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-kudos-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);