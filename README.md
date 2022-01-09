# vvalidator

vvalidator (voodoovalidator, working title, maybe) aims to be a validation library with short syntax and a nice developer experience. This library is inspired by t he [class-validator](https://github.com/typestack/class-validator) package.

## Example

```ts
@Validator()
class UserDto {
  username!: string;
  email!: string;

  description?: string;

  friends: string[];
}

const result = validate(UserDto, {
  username: 'Thanos',
  email: 'thanos@example.com',

  description: 'Purple dude',

  friends: [],
});
```

Validators use the type hints to verify your input data.

## How it works

Under the hood [ts-morph](https://ts-morph.com) is used to analyze the class definitions. When the `@Valdidator()` decorator is used, the call site's line number will be extracted from the call stack.
This information is used to locate the class definition in the source code. As far as I know this is the only way to make the link from runtime to compiletime. This approach is rather hacky and leads to a number of caveats (see next section).

## Caveats

Since vvalidator uses static code analysis to enable much of it's goodies, it is necessary to ship your source code with your deployment.

Because of this, it will not be usable in a browser environment. However, there might be solutions for this, but they will require some extra build steps.

You'll also need sourcemaps and sourcemap support. Tested ways to run applications using vvalidator are `ts-node` and running `tsc` and executing the compiled .js files. This _might_ work with babel or other bundlers, but you need to make sure that sourcemaps are present and useable.

There are also minor restricitons. For example you can't put the decorator and the `class` keyword in the same line. For most formatted code (especially with prettier), this shouldn't cause too much trouble.

Related to this, you **must** use the decorator syntax to annotate the class, so this

```ts
class Test {
  foo!: number;
}

Validator(Test); // <- will probably crash and burn
```

won't work.

## Supported syntax

### Basic types

```ts
@Validator()
class UserDto {
  username!: string;
  alias?: string;

  level!: number;
  isAdmin!: boolean;
}
```

### Inheritance

```ts
@Validator()
class UserDto {
  username!: string;
  email!: string;
}

@Validator()
class AdminUserDto extends UserDto {
  permissions!: string[];
}
```

### Enums

```ts
enum TestEnum {
  YES = 'yes',
  NO = 'no',
}

@Validator()
class Test {
  enumProperty!: TestEnum;
}
```

### Arrays

```ts
@Validator()
class Gauntlet {
  infinityStones: string[];
  powerupForEachInfinityStone: number[];
}
```

Arrays support basic types, nested validators & enums.

### Unions

```ts
@Validator()
class Test {
  basicProperty: number | string | boolean;
}
```

### Nested

```ts
interface IAnimal {
  animalName: string;
  rating: number;
}

@Validator()
class Food {
  name!: string;
  rating!: number;
}

@Validator()
class User {
  favoriteFood: Food;
  favoriteFoods: Food[]; // Arrays are supported
  favoriteFoodWithoutRating: Omit<Food, 'rating'>; // Omit<T, U> is supported

  favoriteAnimal: IFavoriteAnimal; // Interfaces
  favoriteDrink: {
    // Object literals
    drinkName: string;
    rating: number;
  };
}
```

Self-referential structures are also possible

```ts
@Validator()
class TreeNode {
  name!: string;
  children!: TreeNode[];
}
```

### Tuples

```ts
@Validator()
class Test {
  tuple!: [number, string];
}
```

### Records

```ts
@Validator()
class Test {
  record!: Record<string, number>;
}
```

## Todo

As far as types are concerned vvalidator covers what I think are the main use-cases.

Error formatting is still work in progress. It's better than the raw error structure coming from the "AST", but there will be probably some improvements.

Totally absent as of right now, are decorators to add constraints not definable by the type system. For example

@Length(min, max)  
@IsEmail()
