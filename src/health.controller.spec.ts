import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('returns ok status', () => {
    expect(controller.check()).toEqual({ status: 'ok' });
  });
});
