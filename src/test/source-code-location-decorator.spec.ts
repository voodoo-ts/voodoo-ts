import { project } from './utils';
import { ClassDiscovery } from '../class-discovery';
import { SourceCodeLocationDecorator } from '../source-code-location-decorator';

const classDiscovery = new ClassDiscovery(project);

function getError(): Error {
  return new Error();
}

describe('', () => {
  it('should construct', () => {
    const scld = new SourceCodeLocationDecorator(classDiscovery);
    expect(scld).toBeTruthy();
  });

  it('should set metadata on class', () => {
    const scld = new SourceCodeLocationDecorator(classDiscovery);

    @scld.decorator(getError())
    class Test {}

    const metadata = Reflect.getMetadata(scld.symbol, Test);
    expect(metadata).toEqual({
      filename: expect.stringMatching(new RegExp('src/test/source-code-location-decorator.spec.ts$')),
      line: expect.any(Number),
      column: expect.any(Number),
      options: {},
    });
  });

  it('should return metadata', () => {
    const scld = new SourceCodeLocationDecorator(classDiscovery);

    @scld.decorator(getError())
    class Test {}

    const metadata = scld.getClassMetadata(Test);
    expect(metadata).toEqual({
      filename: expect.stringMatching(new RegExp('src/test/source-code-location-decorator.spec.ts$')),
      line: expect.any(Number),
      column: expect.any(Number),
      options: {},
    });
  });
});
