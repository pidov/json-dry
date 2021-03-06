var assert = require('assert'),
    Dry    = require('../index.js'),
    Blast  = require('protoblast')(false),
    Deck   = Blast.Classes.Deck;

Dry.Classes = Blast.Classes;
Dry.Classes.__Protoblast = Blast;

describe('Dry', function TestDry() {

	var dryCirc2,
	    dryCirc;

	describe('.stringify()', function() {
		it('should stringify the object', function() {

			var obj = {},
			    arr = [0,1,2],
			    undry,
			    json,
			    dry;

			obj.a = arr;
			obj.b = arr;

			json = JSON.stringify(obj);
			dry = Dry.stringify(obj);

			assert.equal(dry.length < json.length, true, 'Dry string is not shorter than JSON string');

			undry = Dry.parse(dry);

			assert.equal(undry.a, undry.b, 'Array a & b should be references to the same array');
		});

		it('should stringify circular references', function() {

			var obj = {test: true, arr: [0,1,2]},
			    dry;

			obj.circle = obj;

			dry = Dry.stringify(obj);
			dryCirc = dry;

			assert.equal(dry, '{"test":true,"arr":[0,1,2],"circle":"~"}');

			obj.deep = {obj: obj};
			dryCirc2 = Dry.stringify(obj);
		});

		it('should use #toDry() method of objects', function() {

			var d = new Blast.Classes.Deck(),
			    ntemp,
			    temp,
			    ndry,
			    obj,
			    dry;

			d.push('first');
			obj = {nonroot: d};

			dry = Dry.stringify(d);
			ndry = Dry.stringify(obj);
			temp = JSON.parse(dry);
			ntemp = JSON.parse(ndry);

			assert.equal(temp.path, '__Protoblast.Classes.Deck');
			assert.equal(ntemp.nonroot.path, '__Protoblast.Classes.Deck');
		});

		it('should serialize & revive registered classes', function() {

			var original,
			    dried,
			    res;

			function Person(firstname, lastname) {
				this.firstname = firstname;
				this.lastname  = lastname;
			}

			Person.unDry = function unDry(value) {
				return new Person(value.firstname, value.lastname);
			};

			Person.prototype.toDry = function toDry() {
				return {
					value: {
						firstname : this.firstname,
						lastname  : this.lastname
					}
				};
			};

			Person.prototype.fullname = function fullname() {
				return this.firstname + ' ' + this.lastname;
			};

			Dry.registerClass(Person);

			original = new Person('Lies', 'Lefever');

			dried = Dry.stringify(original);

			res = Dry.parse(dried);

			assert.equal(res.fullname(), original.fullname());
		});

		it('should use registered driers', function() {

			var original,
			    dried,
			    res;

			function MyPerson(firstname, lastname) {
				this.firstname = firstname;
				this.lastname  = lastname;
			}

			MyPerson.prototype.fullname = function fullname() {
				return this.firstname + ' ' + this.lastname;
			};

			Dry.registerDrier('MyPerson', function dryMyPerson(holder, key, value) {
				return {
					firstname : value.firstname,
					lastname  : value.lastname
				};
			});

			Dry.registerUndrier('MyPerson', function unDryMyPerson(holder, key, value) {
				return new MyPerson(value.firstname, value.lastname);
			});

			original = new MyPerson('Lies', 'Lefever');

			dried = Dry.stringify(original);
			res = Dry.parse(dried);

			assert.equal(res.fullname(), original.fullname());

			// Also for root array
			dried = Dry.stringify([original]);
			res = Dry.parse(dried);

			assert.equal(res[0].fullname(),  original.fullname());
			assert.equal(Array.isArray(res), true);
		});

		it('should handle #toJSON calls properly', function() {

			var undried,
			    dried,
			    obj,
			    a;

			a = {a: 1};

			obj = {
				zero: {toJSON: function(){return 0}},
				one: a,
				two: a
			};

			dried = Dry.stringify(obj);
			undried = Dry.parse(dried);

			assert.equal(undried.zero, 0, '#toJSON was not respected');
			assert.equal(undried.one, undried.two, 'References have been messed up');
		});

		it('should drop functions', function() {

			var undried,
			    dried,
			    fnc = function test() {},
			    obj = {a: fnc, b: 1};

			dried = Dry.stringify(obj);
			undried = Dry.parse(dried);

			assert.equal(Dry.stringify(fnc), undefined, 'Function should be returned as undefined');
			assert.equal(undried.a, undefined, 'Functions should be returned as undefined');
			assert.equal(undried.b, 1, 'Other property did not revive');
		});

		it('should escape strings starting with the path separator', function() {

			var expected,
			    original,
			    dried,
			    res;

			original = {
				start : {
					regular_string: '~start'
				},
				regular_string   : '~start',
			};

			original.ref = original.start;

			dried = Dry.stringify(original);

			res = Dry.parse(dried);

			expected = `{"start":{"regular_string":"\\\\x7estart"},"regular_string":"\\\\x7estart","ref":"~start"}`;

			assert.equal(dried,                    expected);
			assert.equal(res.start.regular_string, '~start');
			assert.equal(res.regular_string,       '~start');
			assert.equal(res.ref,                  res.start);
		});

		it('should handle keys with the path separator', function() {

			var expected,
			    original,
			    dried,
			    res;

			original = {
				'start~': {
					a: 1
				}
			};

			original.ref = original['start~'];

			dried = Dry.stringify(original);

			res = Dry.parse(dried);

			expected = `{"start~":{"a":1},"ref":"~start\\\\x7e"}`;

			assert.equal(dried,            expected);
			assert.equal(res['start~'].a,  1);
			assert.equal(res.ref,          res['start~']);
		});

		it('should use shorter paths when possible', function() {

			var expected,
			    original,
			    dried,
			    res;

			original = {
				a_very_long_key: {
					a: 1
				},
			};

			original.short = original.a_very_long_key;
			original['s~'] = original.a_very_long_key;
			original.third = original.a_very_long_key;

			dried = Dry.stringify(original);

			res = Dry.parse(dried);

			expected = `{"a_very_long_key":{"a":1},"short":"~a_very_long_key","s~":"~short","third":"~s\\\\x7e"}`;

			assert.equal(dried,               expected);
			assert.equal(res.short, res.a_very_long_key);
			assert.equal(res.third, res.a_very_long_key);
			assert.equal(res['s~'], res.a_very_long_key);
		});

		it('should use a replacer if given', function() {

			var original,
			    dried,
			    res;

			original = {
				deck : new Deck(),
				fnc  : function someFunction(){},
				str  : ''
			};

			dried = Dry.stringify(original, function replacer(key, value) {
				if (typeof value == 'function') {
					return "a function called '" + value.name + "'";
				}

				return value;
			});

			var expected = `{"deck":{"value":{"ic":0,"dict":{},"array":[],"attributes":{}},"path":"__Protoblast.Classes.Deck","dry":"toDry","drypath":["deck"]},"fnc":"a function called 'someFunction'","str":""}`;

			assert.equal(dried, expected);
		});

		it('should use formatting spaces if given', function() {

			var expected,
			    nr_dried,
			    undried,
			    dried,
			    obj;

			obj = {
				a: [{b: 1}],
				c: {d: 1}
			};

			expected = '{\n  "a": [\n    {\n      "b": 1\n    }\n  ],\n  "c": {\n    "d": 1\n  }\n}';

			dried = Dry.stringify(obj, null, '  ');
			nr_dried = Dry.stringify(obj, null, 2);

			undried = Dry.parse(dried);

			assert.equal(dried, expected);
			assert.equal(nr_dried, expected);

			assert.equal(undried.c.d, obj.c.d);
			assert.equal(undried.a[0].b, obj.a[0].b);
		});

		it('should handle Infinity', function() {

			var undried,
			    dried,
			    obj;

			obj = {
				a : 1,
				b : Infinity,
				c : -Infinity
			};

			dried = Dry.stringify(obj);
			undried = Dry.parse(dried);

			assert.equal(undried.a, 1);
			assert.equal(undried.b, Infinity);
			assert.equal(undried.c, -Infinity);
		});

		it('should handle RegExp', function() {

			var undried,
			    dried,
			    obj;

			obj = {
				regex : /test/i
			};

			dried = Dry.stringify(obj);
			undried = Dry.parse(dried);

			assert.equal(undried.regex.constructor.name, 'RegExp');
			assert.equal(undried.regex+'', '/test/i');

			obj = /rooted/i;
			dried = Dry.stringify(obj);
			undried = Dry.parse(dried);

			assert.equal(undried.constructor.name, 'RegExp');
			assert.equal(undried+'', '/rooted/i');
		});

		it('should handle dates', function() {

			var undried,
			    dried,
			    obj;

			obj = {
				date : new Date()
			};

			dried = Dry.stringify(obj);
			undried = Dry.parse(dried);

			assert.equal(undried.date.constructor.name, 'Date');
			assert.equal(undried.date+'', obj.date+'');

			obj = obj.date;
			dried = Dry.stringify(obj);
			undried = Dry.parse(dried);

			assert.equal(undried.constructor.name, 'Date');
			assert.equal(undried+'', obj+'');
		});
	});

	describe('.parse()', function() {

		it('should parse circular references', function() {

			var undry2,
			    undry;

			undry = Dry.parse(dryCirc);

			assert.equal(undry === undry.circle, true, 'Circular reference in undried object is gone');

			undry2 = Dry.parse(dryCirc2);

			assert.equal(undry2 === undry2.deep.obj, true, 'Deep circular reference in undried object is gone');
		});

		it('should use undry on dried objects that need to be revived', function() {

			var d = new Deck(),
			    dry,
			    undry;

			d.push('first');
			dry = Dry.stringify({mydeck: d});

			undry = Dry.parse(dry);

			assert.equal(undry.mydeck instanceof Deck, true);
		});

		it('should also be able to revive root objects', function() {

			var d = new Deck(),
			    dry,
			    undry;

			d.push('first');
			dry = Dry.stringify(d);

			undry = Dry.parse(dry);

			assert.equal(undry instanceof Deck, true);
		});

		it('should handle complicated revive structures', function() {

			var d = new Deck(),
			    d2 = new Deck(),
			    arr,
			    dry,
			    sub,
			    undry;

			arr = [0,1,2];
			d2.push('sub');
			d2.set('arr', arr);

			d.push('first');
			d.set('subdeck', d2);
			d.set('arr', arr);

			dry = Dry.stringify(d);

			undry = Dry.parse(dry);
			sub = undry.get('subdeck');

			assert.equal(undry instanceof Deck, true, 'Undried object should be a Deck instance');
			assert.equal(sub instanceof Deck, true, 'Sub entry of object should also be a Deck instance');
			assert.equal(undry.get('arr') === sub.get('arr'), true, 'Array in both Decks should be a reference');
		});

		it('should handle recursive links first returned by a toJSON call', function() {

			var undried,
			    dried,
			    root,
			    a,
			    x;

			a = {a: 'a'};
			x = {toJSON: function() {return a}};
			y = {toJSON: function() {return 'y'}};

			root = {
				x: x,
				y: y,
				last: a
			};

			dried = Dry.stringify(root);
			undried = Dry.parse(dried);

			assert.equal(undried.last, undried.x);
		});

		it('should handle the safe character', function() {

			var undried,
			    input = '~This is ~not~ undefined',
			    dried = Dry.stringify(input),
			    driedtwo = Dry.stringify({a: input});

			undried = Dry.parse(dried);

			assert.equal(driedtwo, '{"a":"\\\\x7eThis is ~not~ undefined"}', 'Special chars at the start should be escaped');
			assert.equal(dried, JSON.stringify(input), 'Special chars should not be escaped in a regular string');
			assert.equal(undried, input);
		});

		it('should prevent getting keys out of the prototype', function() {

			var dried,
			    obj,
			    res;

			obj = {
				start: {},
				ref  : '~start~__proto__~constructor'
			};

			// Use regular json for this hack
			dried = JSON.stringify(obj);

			res = Dry.parse(dried);

			assert.equal(res.ref, undefined);
		});
	});

	describe('.toObject()', function() {
		it('should create an object', function() {

			var original,
			    dry_obj,
			    result,
			    entry;

			original = {
				date   : new Date(),
				nr     : 1,
				arr    : [null],
				regex  : /test/i,
				deck   : new Deck()
			};

			entry = {
				a: 1
			};

			original.deck.set('entry', entry);

			dry_obj = Dry.toObject(original);
			result = Dry.parse(dry_obj);

			assert.notEqual(dry_obj.deck.value.dict.entry.value,     entry, 'Same references detected!');
			assert.equal(Blast.Bound.Object.alike(original, result), true,  'The parsed object should be similar to the original');
		});
	});

	describe('.clone()', function() {

		it('should deep clone objects', function() {

			var original,
			    clone;

			original = {
				date   : new Date(),
				nr     : 1,
				arr    : [null],
				regex  : /test/i
			};

			original.circle = original;

			clone = Dry.clone(original);

			assert.equal(clone.date.constructor.name, 'Date');
			assert.equal(clone.date+'', original.date+'');

			assert.equal(clone.nr, original.nr);
			assert.equal(clone.arr[0], original.arr[0]);

			assert.equal(clone.regex.constructor.name, 'RegExp');

			assert.equal(clone.circle, clone);
		});

		it('should use a clone method if it is available on the target', function() {

			var original,
			    clone;

			original = {
				clone: function() {
					return 1;
				}
			};

			clone = Dry.clone(original);

			assert.equal(clone, 1);
		});
	});
});