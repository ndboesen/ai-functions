// Import fetch for making HTTP requests (using node-fetch)
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Helper function to extract an answer's value based on its type
function getAnswerValue(answer) {
  if (answer.type === "text") {
    return answer.text;
  } else if (answer.type === "choice") {
    return answer.choice.label;
  } else if (answer.type === "number") {
    return answer.number;
  } else if (answer.type === "boolean") {
    return answer.boolean ? "Yes" : "No";
  }
  return "";
}

exports.handler = async function(event, context) {
  try {
    // Parse the incoming JSON from your front-end
    const { formId, responseId } = JSON.parse(event.body || "{}");
    if (!formId || !responseId) {
      return { statusCode: 400, body: "Missing formId or responseId" };
    }

    // Fetch the Typeform responses using the provided formId and responseId
    const typeformApiUrl = `https://api.typeform.com/forms/${formId}/responses?included_response_ids=${responseId}`;
    const typeformResponse = await fetch(typeformApiUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.TYPEFORM_API_TOKEN}`
      }
    });
    const typeformData = await typeformResponse.json();
    const responses = typeformData.items;
    if (!responses || responses.length === 0) {
      return { statusCode: 404, body: "No Typeform response found for ID." };
    }
    const answers = responses[0].answers;

    // Extract the six fields from the quiz answers (assuming they come in order)
    let interests = "", skills = "", lifestyle = "", goal = "", tech = "", constraints = "";
    if (answers && answers.length >= 6) {
      interests = getAnswerValue(answers[0]);
      skills = getAnswerValue(answers[1]);
      lifestyle = getAnswerValue(answers[2]);
      goal = getAnswerValue(answers[3]);
      tech = getAnswerValue(answers[4]);
      constraints = getAnswerValue(answers[5]);
    } else {
      // Fallback in case there are fewer than 6 answers
      interests = answers[0] ? getAnswerValue(answers[0]) : "";
      skills = answers[1] ? getAnswerValue(answers[1]) : "";
      lifestyle = answers[2] ? getAnswerValue(answers[2]) : "";
      goal = answers[3] ? getAnswerValue(answers[3]) : "";
      tech = answers[4] ? getAnswerValue(answers[4]) : "";
      constraints = answers[5] ? getAnswerValue(answers[5]) : "";
    }

    // Build the prompt by plugging in the dynamic answers
    const prompt = `You are an expert in crafting innovative, tech-forward business concepts for a modern audience (particularly millennials and Gen Z).

The user has provided the following information:

1. Interests/Passions: ${interests}
2. Skills/Strengths: ${skills}
3. Lifestyle/Work Preferences: ${lifestyle}
4. Main Goal or Ambition: ${goal}
5. Tech/Digital Preferences: ${tech}
6. Additional Constraints or “Dream Business” Details: ${constraints}

**Task**:
Generate five fresh, creative business ideas that align with the user’s inputs. Each idea should be innovative and modern—favoring digital-first or tech-savvy approaches where appropriate.

**Required Format** for each idea:

1. **Idea Title**
2. **Overview (1–3 sentences)**
3. **Key Steps** (at least two)

**Guidelines**:

- Each idea must feel relevant to the user’s interests, skills, and lifestyle.
- If the user has a specific ambition (side hustle, low initial budget), tailor suggestions accordingly.
- Avoid overly generic suggestions like “open a coffee shop.” Focus on tech-forward, digital-friendly, or creative models.
- Incorporate the user’s personality or brand vibe where possible (e.g., remote, flexible hours).
- Aim for originality and creativity—avoid clichés or well-known templates. Keep each idea moderately feasible while still pushing the envelope.

Now, propose **5** distinct ideas in a structured list (1 through 5).`;

    // Call the OpenAI API using the dynamic prompt
    const openAiResponse = await fetch("https://api.openai.com/v1/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "text-davinci-003",
        prompt: prompt,
        max_tokens: 800,
        temperature: 0.7,
        n: 1
      })
    });
    const openAiData = await openAiResponse.json();
    let ideasText = "";
    if (openAiData.choices && openAiData.choices.length > 0) {
      ideasText = openAiData.choices[0].text.trim();
    } else {
      ideasText = "Sorry, I couldn't generate ideas.";
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideas: ideasText })
    };

  } catch (err) {
    console.error("Error in generate-ideas function:", err);
    return {
      statusCode: 500,
      body: "Server Error: " + err.toString()
    };
  }
};
