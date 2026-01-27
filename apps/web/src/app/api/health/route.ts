import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  checks: {
    database: {
      status: 'up' | 'down'
      latencyMs?: number
      error?: string
    }
    environment: {
      status: 'ok' | 'missing'
      missing?: string[]
    }
  }
}

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const _startTime = Date.now()
  const checks: HealthStatus['checks'] = {
    database: { status: 'down' },
    environment: { status: 'ok' },
  }

  // Check required environment variables
  const requiredEnvVars = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
  const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key])

  if (missingEnvVars.length > 0) {
    checks.environment = {
      status: 'missing',
      missing: missingEnvVars,
    }
  }

  // Check database connectivity
  try {
    const supabase = await createClient()
    const dbStart = Date.now()

    // Simple query to test connection
    const { error } = await supabase.from('companies').select('id').limit(1)

    const dbLatency = Date.now() - dbStart

    if (error) {
      checks.database = {
        status: 'down',
        latencyMs: dbLatency,
        error: error.message,
      }
    } else {
      checks.database = {
        status: 'up',
        latencyMs: dbLatency,
      }
    }
  } catch (error) {
    checks.database = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // Determine overall status
  let overallStatus: HealthStatus['status'] = 'healthy'

  if (checks.database.status === 'down') {
    overallStatus = 'unhealthy'
  } else if (checks.environment.status === 'missing') {
    overallStatus = 'degraded'
  }

  const response: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    checks,
  }

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503

  return NextResponse.json(response, { status: statusCode })
}

// Support HEAD requests for simple uptime checks
export async function HEAD(): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('companies').select('id').limit(1)

    if (error) {
      return new NextResponse(null, { status: 503 })
    }

    return new NextResponse(null, { status: 200 })
  } catch {
    return new NextResponse(null, { status: 503 })
  }
}
