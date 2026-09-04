import { Hono } from 'hono';
import { isValidAddress } from 'algosdk';
import { ZKPVerifierService, defaultZKPVerifierService, ZKProofPayload } from '../services/zkp.js';

export function createZKProofRoutes(zkpService: ZKPVerifierService = defaultZKPVerifierService) {
  const zkApp = new Hono();

  const handleVerifyZKProof = async (c: any) => {
    const body = (await c.req.json().catch(() => ({}))) as ZKProofPayload;

    if (!body || !body.agentAddress) {
      return c.json({ success: false, error: 'agentAddress is required' }, 400);
    }

    if (!isValidAddress(body.agentAddress)) {
      return c.json({ success: false, error: 'Invalid Algorand address format' }, 400);
    }

    const result = await zkpService.verifyProof(body);

    if (!result.valid) {
      return c.json(
        {
          success: false,
          error: result.error || 'Invalid ZK Proof',
          result,
        },
        400
      );
    }

    return c.json({
      success: true,
      result,
      verificationLevel: result.verificationLevel,
    });
  };

  zkApp.post('/verify/zk-proof', handleVerifyZKProof);
  zkApp.post('/zk-proof', handleVerifyZKProof);

  return zkApp;
}

const zkProofApp = createZKProofRoutes();
export default zkProofApp;
