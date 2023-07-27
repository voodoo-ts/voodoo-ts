# voodoo-ts

voodoo-ts aims to be a validation library with short syntax and a nice developer experience. This library is inspired by the [class-validator](https://github.com/typestack/class-validator) package.

## Example

```typescript
voodoo.Dto()
class UserDto {
  username!: string;
  email!: string;

  description?: string;

  itemsCollected: string[];
}

const result = validate(UserDto, {
  username: 'Thanos',
  email: 'thanos@example.com',

  description: 'Purple dude',

  itemCollected: ['Soul Stone'],
});
```

Validators use the type hints to verify your input data.

## Getting started

```bash
npm install @voodoo-ts/voodoo-ts
```

Create a file in your project

```typescript
import { TransformerInstance } from '@voodoo-ts/voodoo-ts';

export const voodoo = TransformerInstance.withDefaultProject();  // Export the whole thing
export { Dto, transform, transformOrThrow, transformer } = voodoo.unwrap(); // Export decorator and transform function
```

`withDefaultProject()` will use the tsconfig.json in your project root. If you want more control over
this you need to create a ts-morph `Project` and configure it before passing it to the `TransformerInstance`

```typescript
import { Dto, transform } from './your-created-file.ts';

@Dto()
class UserDto {
  name!: string;
  powerlevel!: number;
}

const result = await transform(UserDto, { name: 'Vegeta', powerlevel: 9001 });
if (result.success) {
  // You can use result.object here
  console.log(result.object);
} else {
  // Handle errors yourself
}

const user = await transformOrThrow(UserDto, { name: 'Mordecai', powerlevel: 5 });
// If this point is reached, `user` will be a UserDto instance
```

Objects are validated before transforming. There is also a `validate()` and `validateOrThrow()` method which only validates objects. These will return the
incoming object _untouched_ in `result.object`.

Most types are regcognized. Check [Supported Syntax](#supported-syntax) for reference.

## Unknown fields

Objects created by `transform()` will never contain properties which are not defined in the Dto. By default validation fails if unknown properties are discovered.
You can change this by using `transform(DtoClass, { some object }, { allowUnknownFields: true })`.

Be careful if you pass this to `validate()`. This will not clean up unknown properties.
You either need to make sure this won't cause you problems or use `transform()`

## Supported syntax

### Basic types

```typescript
voodoo.Dto()
class UserDto {
  username!: string;
  alias?: string; // optional

  level!: number;
  isAdmin!: boolean;
}
```

### Inheritance

```typescript
voodoo.Dto()
class UserDto {
  username!: string;
  email!: string;
}

voodoo.Dto()
class AdminUserDto extends UserDto {
  permissions!: string[];
}
```

### Enums

```typescript
enum TestEnum {
  YES = 'yes',
  NO = 'no',
}

voodoo.Dto()
class Test {
  enumProperty!: TestEnum;
}
```

### Arrays

```typescript
voodoo.Dto()
class Gauntlet {
  infinityStones: string[];
  powerupForEachInfinityStone: number[];
}
```

Arrays support basic types, nested validators & enums.

### Unions

```typescript
voodoo.Dto()
class Test {
  basicProperty!: number | string | boolean;
  nullable!: number | null;
}
```

### Nested

```typescript
interface IAnimal {
  animalName: string;
  rating: number;
}

voodoo.Dto()
class Food {
  name!: string;
  rating!: number;
}

voodoo.Dto()
class User {
  favoriteFood!: Food;
  favoriteFoods!: Food[]; // Arrays are supported
  favoriteFoodWithoutRating!: Omit<Food, 'rating'>; // Omit<T, U> is supported
  favoriteFoodName!: Pick<Food, 'name'>; // Pick<T, U> is also supported
  incompleteFoodData!: Partial<Food>;

  favoriteAnimal!: IFavoriteAnimal; // Interfaces
  favoriteDrink!: {
    // Object literals
    drinkName: string;
    rating: number;
  };
}
```

Self-referential structures are also possible

```typescript
voodoo.Dto()
class TreeNode {
  name!: string;
  children!: TreeNode[];
}
```

### Tuples

```typescript
voodoo.Dto()
class Test {
  tuple!: [number, string];
}
```

### Records

```typescript
voodoo.Dto()
class Test {
  record!: Record<string, number>;
}
```

## Decorators

voodoo-ts ships with some decorators to define constraints that can't be provided by type hints.

If you need something that can't be covered by these decorators, you can create your own using `createAnnotationDecorator`. You can use the existing decorators as reference.

### @Validate((node: DecoratorNode, value: any) => INodeValidationResult)

Generic decorator which takes a function as validation callback. API is work in progress.

### @IsNumber()

Validates if a string can be parsed as number (including floats)

### @IsInteger(radix?)

Validates if a string can be parsed as an integer.

### @Length(min, max?)

Validates string or array length. If you have an array of strings you can use `@ArrayLength(min, max?)` and `StringLength(min, max?)`

### @Range(min, max?)

Validates if a number is between min and max.

### @IsNumberList(separator?, radix?)

Checks if a string consists of a list of numbers separated by `separator`.

### @ValidateIf((value: any, values: Record<string, any>) => boolean)

Validate a field only if the callback returned `true`.

### @From(propertyName: string)

This allows you to get value for the field annoated with @From from a differnt field.
You can use this to translate property names. For example:

```typescript
@voodoo.Dto()
class Config {
  @From('SOME_ENV_VAR')
  settingFromSomeEnvVar!: string;
}

const config = transform(Config, process.env, { allowUnknownFields: true });
```

## How it works

Under the hood [ts-morph](https://ts-morph.com) is used to analyze the class definitions. When the `@Valdidator()` decorator is used, the call site's line number will be extracted from the call stack.
This information is used to locate the class definition in the source code. As far as I know this is the only way to make the link from runtime to compiletime. This approach is rather hacky and leads to a number of caveats (see "Caveats" section).

## Caveats

Since voodoo-ts uses static code analysis to enable much of it's goodies, it is necessary to ship your source code with your deployment (for now).

Because of this, it will not be usable in a browser environment. However, there might be solutions for this, but they will require some extra build steps.

You'll also need sourcemaps and sourcemap support. Tested ways to run applications using voodoo-ts are `ts-node` and running `tsc` and executing the compiled .js files. This _might_ work with babel or other bundlers, but you need to make sure that sourcemaps are present and useable.

You **must** use the decorator syntax to annotate the class, so this

```typescript
class Test {
  foo!: number;
}

voodoo.Dto(Test);
```

won't work.

## Todo

* Error formatting could be improved.
* Serialize dtos to remove the dependency on sources.
