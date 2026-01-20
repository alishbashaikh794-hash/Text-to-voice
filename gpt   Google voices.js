addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
const PICCY_API_URL = "https://www.sparklingapps.com/piccybotapi/index.php/speech"

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  if (request.method !== 'GET') {
    return errorResponse('Only GET requests are allowed', 400)
  }

  if (path === '/' || path === '') {
    return jsonResponse({
      status_code: 200,
      message: 'Text to Speech API - PiccyBot',
      endpoints: {
        voices: '/voices - List available voices',
        tts: '/tts?voice=alloy&text=Hello - Generate audio'
      },
      example: `${url.origin}/tts?voice=nova&text=Hello`
    })
  }

  if (path === '/voices' || path === '/voices/') {
    return jsonResponse({
      status_code: 200,
      message: 'Available voices in PiccyBot',
      voices: VOICES,
      total: VOICES.length
    })
  }

  if (path === '/tts' || path === '/tts/') {
    const voice = url.searchParams.get('voice')
    const text = url.searchParams.get('text')

    if (!voice || !text || voice.trim() === '' || text.trim() === '') {
      return errorResponse('Voice and text parameters are required', 400)
    }

    const cleanVoice = voice.toLowerCase().trim()
    const cleanText = text.trim()

    if (!VOICES.includes(cleanVoice)) {
      return errorResponse(`Invalid voice. Available voices: ${VOICES.join(', ')}`, 400)
    }

    if (cleanText.length > 5000) {
      return errorResponse('Text cannot exceed 5000 characters', 400)
    }

    try {
      const audio = await generatePiccyBotTTS(cleanVoice, cleanText)
      
      return new Response(audio, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': `attachment; filename="tts_${cleanVoice}.mp3"`,
          ...CORS
        }
      })
    } catch (error) {
      console.error('TTS Generation Error:', error)
      return errorResponse(`Generation failed: ${error.message}`, 500)
    }
  }

  return errorResponse('Endpoint not found. Use /, /voices or /tts', 404)
}

async function generatePiccyBotTTS(voice, text) {
  const instructedText = `Read only this text word by word, do not add anything else: ${text}`
  
  const payload = {
    extracted_content: instructedText,
    voice: voice,
    exp: true,
    mode: "standard",
    purchase_token: "",
    sub: true,
    piccy_valid: ""
  }

  const response = await fetch(PICCY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'PiccyBot/1.76',
      'Accept': '*/*'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000)
  })

  if (!response.ok) {
    throw new Error(`PiccyBot API returned status ${response.status}`)
  }

  const audioBuffer = await response.arrayBuffer()

  if (audioBuffer.byteLength === 0) {
    throw new Error('Empty response from PiccyBot API')
  }

  return audioBuffer
}

function errorResponse(message, status) {
  return jsonResponse({ 
    status_code: status, 
    error: true,
    message 
  }, status)
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 
      'Content-Type': 'application/json', 
      ...CORS 
    }
  })
}