/*global I18n:true */

// Instantiate the object
var I18n = I18n || {};

// Set default locale to english
I18n.defaultLocale = "en";

// Set default pluralization rule
I18n.pluralizationRules = {
  en: function(n) {
    return n === 0 ? ["zero", "none", "other"] : n === 1 ? "one" : "other";
  }
};

// Set current locale to null
I18n.locale = null;
I18n.fallbackLocale = null;

// Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
I18n.PLACEHOLDER = /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm;

I18n.SEPARATOR = ".";

I18n.noFallbacks = false;

I18n.isValidNode = function(obj, node, undefined) {
  return obj[node] !== null && obj[node] !== undefined;
};

I18n.lookup = function(scope, options) {
  options = options || {};

  var translations = this.prepareOptions(I18n.translations),
    locale = options.locale || I18n.currentLocale(),
    messages = translations[locale] || {},
    currentScope;

  options = this.prepareOptions(options);

  if (typeof scope === "object") {
    scope = scope.join(this.SEPARATOR);
  }

  if (options.scope) {
    scope = options.scope.toString() + this.SEPARATOR + scope;
  }

  var originalScope = scope;
  scope = scope.split(this.SEPARATOR);

  if (scope.length > 0 && scope[0] !== "js") {
    scope.unshift("js");
  }

  while (messages && scope.length > 0) {
    currentScope = scope.shift();
    messages = messages[currentScope];
  }

  if (messages === undefined && this.extras && this.extras[locale]) {
    messages = this.extras[locale];
    scope = originalScope.split(this.SEPARATOR);

    while (messages && scope.length > 0) {
      currentScope = scope.shift();
      messages = messages[currentScope];
    }
  }

  if (messages === undefined) {
    messages = options.defaultValue;
  }

  return messages;
};

// Merge serveral hash options, checking if value is set before
// overwriting any value. The precedence is from left to right.
//
//   I18n.prepareOptions({name: "John Doe"}, {name: "Mary Doe", role: "user"});
//   #=> {name: "John Doe", role: "user"}
//
I18n.prepareOptions = function() {
  var options = {},
    opts,
    count = arguments.length;

  for (var i = 0; i < count; i++) {
    opts = arguments[i];

    if (!opts) {
      continue;
    }

    for (var key in opts) {
      if (!this.isValidNode(options, key)) {
        options[key] = opts[key];
      }
    }
  }

  return options;
};

I18n.interpolate = function(message, options) {
  options = this.prepareOptions(options);

  var matches = message.match(this.PLACEHOLDER),
    placeholder,
    value,
    name;

  if (!matches) {
    return message;
  }

  for (var i = 0; (placeholder = matches[i]); i++) {
    name = placeholder.replace(this.PLACEHOLDER, "$1");

    if (typeof options[name] === "string") {
      // The dollar sign (`$`) is a special replace pattern, and `$&` inserts
      // the matched string. Thus dollars signs need to be escaped with the
      // special pattern `$$`, which inserts a single `$`.
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter
      value = options[name].replace(/\$/g, "$$$$");
    } else {
      value = options[name];
    }

    if (!this.isValidNode(options, name)) {
      value = "[missing " + placeholder + " value]";
    }

    var regex = new RegExp(
      placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}")
    );
    message = message.replace(regex, value);
  }

  return message;
};

I18n.translate = function(scope, options) {
  options = this.prepareOptions(options);
  options.needsPluralization = typeof options.count === "number";
  options.ignoreMissing = !this.noFallbacks;

  var translation = this.findTranslation(scope, options);

  if (!this.noFallbacks) {
    if (!translation && this.fallbackLocale) {
      options.locale = this.fallbackLocale;
      translation = this.findTranslation(scope, options);
    }

    options.ignoreMissing = false;

    if (!translation && this.currentLocale() !== this.defaultLocale) {
      options.locale = this.defaultLocale;
      translation = this.findTranslation(scope, options);
    }

    if (!translation && this.currentLocale() !== "en") {
      options.locale = "en";
      translation = this.findTranslation(scope, options);
    }
  }

  try {
    return this.interpolate(translation, options);
  } catch (error) {
    return this.missingTranslation(scope);
  }
};

I18n.findTranslation = function(scope, options) {
  var translation = this.lookup(scope, options);

  if (translation && options.needsPluralization) {
    translation = this.pluralize(translation, scope, options);
  }

  return translation;
};

I18n.toNumber = function(number, options) {
  options = this.prepareOptions(options, this.lookup("number.format"), {
    precision: 3,
    separator: this.SEPARATOR,
    delimiter: ",",
    strip_insignificant_zeros: false
  });

  var negative = number < 0,
    string = Math.abs(number)
      .toFixed(options.precision)
      .toString(),
    parts = string.split(this.SEPARATOR),
    precision,
    buffer = [],
    formattedNumber;

  number = parts[0];
  precision = parts[1];

  while (number.length > 0) {
    buffer.unshift(number.substr(Math.max(0, number.length - 3), 3));
    number = number.substr(0, number.length - 3);
  }

  formattedNumber = buffer.join(options.delimiter);

  if (options.precision > 0) {
    formattedNumber += options.separator + parts[1];
  }

  if (negative) {
    formattedNumber = "-" + formattedNumber;
  }

  if (options.strip_insignificant_zeros) {
    var regex = {
      separator: new RegExp(options.separator.replace(/\./, "\\.") + "$"),
      zeros: /0+$/
    };

    formattedNumber = formattedNumber
      .replace(regex.zeros, "")
      .replace(regex.separator, "");
  }

  return formattedNumber;
};

I18n.toHumanSize = function(number, options) {
  var kb = 1024,
    size = number,
    iterations = 0,
    unit,
    precision;

  while (size >= kb && iterations < 4) {
    size = size / kb;
    iterations += 1;
  }

  if (iterations === 0) {
    unit = this.t("number.human.storage_units.units.byte", { count: size });
    precision = 0;
  } else {
    unit = this.t(
      "number.human.storage_units.units." +
        [null, "kb", "mb", "gb", "tb"][iterations]
    );
    precision = size - Math.floor(size) === 0 ? 0 : 1;
  }

  options = this.prepareOptions(options, {
    precision: precision,
    format: "%n%u",
    delimiter: ""
  });

  number = this.toNumber(size, options);
  number = options.format.replace("%u", unit).replace("%n", number);

  return number;
};

I18n.pluralizer = function(locale) {
  var pluralizer = this.pluralizationRules[locale];
  if (pluralizer !== undefined) return pluralizer;
  return this.pluralizationRules["en"];
};

I18n.findAndTranslateValidNode = function(keys, translation) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (this.isValidNode(translation, key)) return translation[key];
  }
  return null;
};

I18n.pluralize = function(translation, scope, options) {
  if (typeof translation !== "object") return translation;

  options = this.prepareOptions(options);
  var count = options.count.toString();

  var pluralizer = this.pluralizer(options.locale || this.currentLocale());
  var key = pluralizer(Math.abs(count));
  var keys = typeof key === "object" && key instanceof Array ? key : [key];

  var message = this.findAndTranslateValidNode(keys, translation);

  if (message !== null || options.ignoreMissing) {
    return message;
  }

  return this.missingTranslation(scope, keys[0]);
};

I18n.missingTranslation = function(scope, key) {
  var message = "[" + this.currentLocale() + this.SEPARATOR + scope;
  if (key) {
    message += this.SEPARATOR + key;
  }
  return message + "]";
};

I18n.currentLocale = function() {
  return I18n.locale || I18n.defaultLocale;
};

I18n.enableVerboseLocalization = function() {
  var counter = 0;
  var keys = {};
  var t = I18n.t;

  I18n.noFallbacks = true;

  I18n.t = I18n.translate = function(scope, value) {
    var current = keys[scope];
    if (!current) {
      current = keys[scope] = ++counter;
      var message = "Translation #" + current + ": " + scope;
      if (!_.isEmpty(value)) {
        message += ", parameters: " + JSON.stringify(value);
      }
      // eslint-disable-next-line no-console
      console.info(message);
    }
    return t.apply(I18n, [scope, value]) + " (#" + current + ")";
  };
};

I18n.enableVerboseLocalizationSession = function() {
  sessionStorage.setItem("verbose_localization", "true");
  I18n.enableVerboseLocalization();

  return "Verbose localization is enabled. Close the browser tab to turn it off. Reload the page to see the translation keys.";
};

// shortcuts
I18n.t = I18n.translate;


MessageFormat = {locale: {}};
I18n._compiledMFs = {"topic.read_more_MF" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "UNREAD";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"zero" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "تبقى <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>موضوع واحد غير مقروء</a>";
return r;
},
"two" : function(d){
var r = "";
r += "تبقى <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>موضوعان غير مقروءان</a>";
return r;
},
"few" : function(d){
var r = "";
r += "تبقت <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " مواضيع غير مقروءة</a>";
return r;
},
"many" : function(d){
var r = "";
r += "تبقى <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " موضوعا غير مقروء</a>";
return r;
},
"other" : function(d){
var r = "";
r += "تبقى <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " موضوع غير مقروء</a>";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "BOTH";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "و";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "NEW";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"zero" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "UNREAD";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"zero" : function(d){
var r = "";
r += "تبقى ";
return r;
},
"one" : function(d){
var r = "";
return r;
},
"two" : function(d){
var r = "";
return r;
},
"few" : function(d){
var r = "";
return r;
},
"many" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
if ( pf_1[ k_2 + "" ] ) {
r += pf_1[ k_2 + "" ]( d ); 
}
else {
r += (pf_1[ MessageFormat.locale["ar"]( k_2 - off_1 ) ] || pf_1[ "other" ] )( d );
}
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>موضوع واحد جديد</a>";
return r;
},
"two" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "UNREAD";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"zero" : function(d){
var r = "";
r += "تبقى ";
return r;
},
"one" : function(d){
var r = "";
return r;
},
"two" : function(d){
var r = "";
return r;
},
"few" : function(d){
var r = "";
return r;
},
"many" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
if ( pf_1[ k_2 + "" ] ) {
r += pf_1[ k_2 + "" ]( d ); 
}
else {
r += (pf_1[ MessageFormat.locale["ar"]( k_2 - off_1 ) ] || pf_1[ "other" ] )( d );
}
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>موضوعان جديدان</a>";
return r;
},
"few" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "UNREAD";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"zero" : function(d){
var r = "";
r += "تبقت ";
return r;
},
"one" : function(d){
var r = "";
return r;
},
"two" : function(d){
var r = "";
return r;
},
"few" : function(d){
var r = "";
return r;
},
"many" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
if ( pf_1[ k_2 + "" ] ) {
r += pf_1[ k_2 + "" ]( d ); 
}
else {
r += (pf_1[ MessageFormat.locale["ar"]( k_2 - off_1 ) ] || pf_1[ "other" ] )( d );
}
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " مواضيع جديدة</a>";
return r;
},
"many" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "UNREAD";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"zero" : function(d){
var r = "";
r += "تبقى ";
return r;
},
"one" : function(d){
var r = "";
return r;
},
"two" : function(d){
var r = "";
return r;
},
"few" : function(d){
var r = "";
return r;
},
"many" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
if ( pf_1[ k_2 + "" ] ) {
r += pf_1[ k_2 + "" ]( d ); 
}
else {
r += (pf_1[ MessageFormat.locale["ar"]( k_2 - off_1 ) ] || pf_1[ "other" ] )( d );
}
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " موضوعا جديدا</a>";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "UNREAD";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"zero" : function(d){
var r = "";
r += "تبقى ";
return r;
},
"one" : function(d){
var r = "";
return r;
},
"two" : function(d){
var r = "";
return r;
},
"few" : function(d){
var r = "";
return r;
},
"many" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
if ( pf_1[ k_2 + "" ] ) {
r += pf_1[ k_2 + "" ]( d ); 
}
else {
r += (pf_1[ MessageFormat.locale["ar"]( k_2 - off_1 ) ] || pf_1[ "other" ] )( d );
}
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " موضوع جديد</a>";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "، أو ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "تصفّح المواضيع الأخرى في ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
return r;
},
"false" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
return r;
}, "flagging.delete_confirm_MF" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "posts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"zero" : function(d){
var r = "";
r += "ليس للمستخدم أيّة مشاركات";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "\n";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "topics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"zero" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "posts";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"zero" : function(d){
var r = "";
r += "أو مواضيع.";
return r;
},
"other" : function(d){
var r = "";
r += "ليس للمستخدم أيّة مواضيع.";
return r;
}
};
if ( pf_1[ k_2 + "" ] ) {
r += pf_1[ k_2 + "" ]( d ); 
}
else {
r += (pf_1[ MessageFormat.locale["ar"]( k_2 - off_1 ) ] || pf_1[ "other" ] )( d );
}
r += "\n ";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "posts";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"zero" : function(d){
var r = "";
r += ".";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
if ( pf_1[ k_2 + "" ] ) {
r += pf_1[ k_2 + "" ]( d ); 
}
else {
r += (pf_1[ MessageFormat.locale["ar"]( k_2 - off_1 ) ] || pf_1[ "other" ] )( d );
}
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "\nأنت على وشك\n";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "posts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"zero" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "topics";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"zero" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
r += "حذف";
return r;
}
};
if ( pf_1[ k_2 + "" ] ) {
r += pf_1[ k_2 + "" ]( d ); 
}
else {
r += (pf_1[ MessageFormat.locale["ar"]( k_2 - off_1 ) ] || pf_1[ "other" ] )( d );
}
return r;
},
"other" : function(d){
var r = "";
r += "حذف";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "\n";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "posts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"zero" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "مشاركة واحدة";
return r;
},
"two" : function(d){
var r = "";
r += "مشاركتين";
return r;
},
"few" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " مشاركات";
return r;
},
"many" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " مشاركة";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " مشاركة";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "\n";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "posts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"zero" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "topics";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"zero" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
r += "و";
return r;
}
};
if ( pf_1[ k_2 + "" ] ) {
r += pf_1[ k_2 + "" ]( d ); 
}
else {
r += (pf_1[ MessageFormat.locale["ar"]( k_2 - off_1 ) ] || pf_1[ "other" ] )( d );
}
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "\n";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "topics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"zero" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "موضوع واحد";
return r;
},
"two" : function(d){
var r = "";
r += "موضوعين";
return r;
},
"few" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " مواضيع";
return r;
},
"many" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " موضوعًا";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " موضوع";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "\n";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "posts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"zero" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "topics";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"zero" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
r += "له، و";
return r;
}
};
if ( pf_1[ k_2 + "" ] ) {
r += pf_1[ k_2 + "" ]( d ); 
}
else {
r += (pf_1[ MessageFormat.locale["ar"]( k_2 - off_1 ) ] || pf_1[ "other" ] )( d );
}
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "topics";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"zero" : function(d){
var r = "";
r += "له، و";
return r;
},
"other" : function(d){
var r = "";
r += "للمستخدم، و";
return r;
}
};
if ( pf_1[ k_2 + "" ] ) {
r += pf_1[ k_2 + "" ]( d ); 
}
else {
r += (pf_1[ MessageFormat.locale["ar"]( k_2 - off_1 ) ] || pf_1[ "other" ] )( d );
}
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "\nإزالة حسابه، ومنع التّسجيل من عنوان IP هذا <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b>، وإضافة عنوان البريد الإلكترونيّ <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> إلى قائمة منع دائم. أمتأكّد حقًّا من أنّ هذا المستخدم ناشر سخام؟";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"zero" : function(d){
var r = "";
r += "ليس في هذا الموضوع أي رد";
return r;
},
"one" : function(d){
var r = "";
r += "في هذا الموضوع رد واحد";
return r;
},
"two" : function(d){
var r = "";
r += "في هذا الموضوع ردان";
return r;
},
"few" : function(d){
var r = "";
r += "في هذا الموضوع " + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " ردود";
return r;
},
"many" : function(d){
var r = "";
r += "في هذا الموضوع " + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " ردا";
return r;
},
"other" : function(d){
var r = "";
r += "في هذا الموضوع " + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " رد";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "ونسبة الإعجاب إلى المشاركة عالية";
return r;
},
"med" : function(d){
var r = "";
r += "ونسبة الإعجاب إلى المشاركة عالية جدا";
return r;
},
"high" : function(d){
var r = "";
r += "ونسبة الإعجاب إلى المشاركة مهولة";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += "\n";
return r;
}, "admin.user.delete_all_posts_confirm_MF" : function(d){
var r = "";
r += "أنت على وشك ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"zero" : function(d){
var r = "";
r += "عدم حذف شيء";
return r;
},
"one" : function(d){
var r = "";
r += "حذف مشاركة واحدة";
return r;
},
"two" : function(d){
var r = "";
r += "حذف مشاركتين";
return r;
},
"few" : function(d){
var r = "";
r += "حذف " + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " مشاركات";
return r;
},
"many" : function(d){
var r = "";
r += "حذف " + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " مشاركة";
return r;
},
"other" : function(d){
var r = "";
r += "حذف " + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " مشاركة";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"zero" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "وموضوع واحد";
return r;
},
"two" : function(d){
var r = "";
r += "وموضوعين";
return r;
},
"few" : function(d){
var r = "";
r += "و" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " مواضيع";
return r;
},
"many" : function(d){
var r = "";
r += "و" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " موضوعا";
return r;
},
"other" : function(d){
var r = "";
r += "و" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " موضوع";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". أمتأكد؟";
return r;
}, "too_few_topics_and_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_topics_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "共有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "logs_error_rate_notice.reached_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>达到了站点设置中的限制";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "logs_error_rate_notice.reached_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b>1 – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>已经达到站点设置限制 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "logs_error_rate_notice.exceeded_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>超出了站点设置中的限制";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "logs_error_rate_notice.exceeded_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b>1 – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>已经超出站点设置限制 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ar"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "topic.bumped_at_title_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected [a-zA-Z$_] but \"%u9996\" found. at undefined:1376:10";}};
MessageFormat.locale.ar = function(n) {
  if (n === 0) {
    return 'zero';
  }
  if (n == 1) {
    return 'one';
  }
  if (n == 2) {
    return 'two';
  }
  if ((n % 100) >= 3 && (n % 100) <= 10 && n == Math.floor(n)) {
    return 'few';
  }
  if ((n % 100) >= 11 && (n % 100) <= 99 && n == Math.floor(n)) {
    return 'many';
  }
  return 'other';
};

(function() {

  I18n.messageFormat = function(key, options) {
    var fn = I18n._compiledMFs[key];
    if (fn) {
      try {
        return fn(options);
      } catch(err) {
        return err.message;
      }
    } else {
      return 'Missing Key: ' + key;
    }
    return I18n._compiledMFs[key](options);
  };

})();

I18n.translations = {"ar":{"js":{"number":{"format":{"separator":".","delimiter":"’"},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"zero":"بايت","one":"بايت","two":"بايت","few":"بايت","many":"بايت","other":"بايت"},"gb":"غ.بايت","kb":"ك.بايت","mb":"م.بايت","tb":"ت.بايت"}}},"short":{"thousands":"{{number}} ألف","millions":"{{number}} مليون"}},"dates":{"time":"h:mm a","time_with_zone":"h:mm a (z)","time_short_day":"ddd, HH:mm","timeline_date":"MMM YYYY","long_no_year_no_time":"D MMM","full_no_year_no_time":"Do MMMM","long_with_year":"D MMM YYYY h:mm a","long_with_year_no_time":"D MMM YYYY","full_with_year_no_time":"D MMM YYYY","long_date_with_year":"D MMM YYYY، LT","long_date_without_year":"D MMM، LT","long_date_with_year_without_time":"D MMM YYYY","long_date_without_year_with_linebreak":"D MMM\u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM YYYY \u003cbr/\u003eLT","wrap_ago":"منذ %{date}","tiny":{"half_a_minute":"\u003c دقيقة","less_than_x_seconds":{"zero":"\u003c 0 ثانية","one":"\u003c %{count} ثانية","two":"\u003c ثانيتين","few":"\u003c %{count}ث","many":"\u003c %{count}ث","other":"\u003c %{count}ث"},"x_seconds":{"zero":"%{count}ث","one":"%{count}ث","two":"%{count}ث","few":"%{count}ث","many":"%{count}ث","other":"%{count}ث"},"less_than_x_minutes":{"zero":"\u003c %{count}ش","one":"\u003c %{count}ش","two":"\u003c %{count}ش","few":"\u003c %{count}ش","many":"\u003c %{count}ش","other":"\u003c %{count}ش"},"x_minutes":{"zero":"%{count}د","one":"%{count}د","two":"%{count}د","few":"%{count}د","many":"%{count}د","other":"%{count}د"},"about_x_hours":{"zero":"%{count}س","one":"%{count}س","two":"%{count}س","few":"%{count}س","many":"%{count}س","other":"%{count}س"},"x_days":{"zero":"%{count}ي","one":"%{count}ي","two":"%{count}ي","few":"%{count}ي","many":"%{count}ي","other":"%{count}ي"},"x_months":{"zero":"%{count}شهر","one":"%{count}شهر","two":"%{count}شهران","few":"%{count}أشهر","many":"%{count}أشهر","other":"%{count}أشهر"},"about_x_years":{"zero":"%{count}ع","one":"%{count}ع","two":"%{count}ع","few":"%{count}ع","many":"%{count}ع","other":"%{count}ع"},"over_x_years":{"zero":"\u003e %{count}ع","one":"\u003e %{count}ع","two":"\u003e %{count}ع","few":"\u003e %{count}ع","many":"\u003e %{count}ع","other":"\u003e %{count}ع"},"almost_x_years":{"zero":"%{count}ع","one":"%{count}ع","two":"%{count}ع","few":"%{count}ع","many":"%{count}ع","other":"%{count}ع"},"date_month":"[في] D MMM","date_year":"[في] MMM YYYY"},"medium":{"x_minutes":{"zero":"أقل من دقيقة","one":"دقيقة واحدة","two":"دقيقتان","few":"%{count} دقائق","many":"%{count} دقيقة","other":"%{count} دقيقة"},"x_hours":{"zero":"أقل من ساعة","one":"ساعة واحدة","two":"ساعتان","few":"%{count} ساعات","many":"%{count} ساعة","other":"%{count} ساعات"},"x_days":{"zero":"أقل من يوم","one":"يوم واحد","two":"يومان","few":"%{count} أيام","many":"%{count} يوما","other":"%{count} ايام"},"date_year":"D MMM، YYYY"},"medium_with_ago":{"x_minutes":{"zero":"قبل أقل من دقيقة","one":"قبل دقيقة واحدة","two":"قبل دقيقتين","few":"قبل %{count} دقائق","many":"قبل %{count} دقيقة","other":"قبل %{count} دقيقة"},"x_hours":{"zero":"قبل أقل من ساعة","one":"قبل ساعة واحدة","two":"قبل ساعتين","few":"قبل %{count} ساعات","many":"قبل %{count} ساعة","other":"قبل %{count} ساعة"},"x_days":{"zero":"قبل أقل من يوم","one":"قبل يوم واحد","two":"قبل يومين","few":"قبل %{count} أيام","many":"قبل %{count} يوما","other":"قبل %{count} يوما"},"x_months":{"zero":"قبل %{count} شهر","one":"قبل %{count} شهر","two":"قبل %{count} شهران","few":"قبل %{count} أشهر","many":"قبل %{count} أشهر","other":"قبل %{count} أشهر"},"x_years":{"zero":"قبل %{count} سنة","one":"قبل %{count} سنة","two":"قبل %{count} سنتان","few":"قبل %{count} سنوات","many":"قبل %{count} سنوات","other":"قبل %{count} سنوات"}},"later":{"x_days":{"zero":"بعد أقل من يوم","one":"بعد يوم واحد","two":"بعد يومين","few":"بعد %{count} أيام","many":"بعد %{count} يوما","other":"بعد %{count} يوم"},"x_months":{"zero":"بعد أقل من شهر","one":"بعد شهر واحد","two":"بعد شهرين","few":"بعد %{count} أشهر","many":"بعد %{count} شهرا","other":"بعد %{count} شهر"},"x_years":{"zero":"بعد أقل من عام","one":"بعد عام واحدة","two":"بعد عامين","few":"بعد %{count} عام","many":"بعد %{count} عام","other":"بعد %{count} عام"}},"previous_month":"الشهر الماضي","next_month":"الشهر القادم","placeholder":"التاريخ"},"share":{"topic_html":"الموضوع: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"المنشور رقم %{postNumber}","close":"أغلق","twitter":"شارك هذا رابط على تويتر","facebook":"شارك هذا رابط على الفيسبوك","email":"ارسل هذا رابط الى البريد الإليكتروني"},"action_codes":{"public_topic":"أجعل هذا الموضوع عامًّا %{when}","private_topic":"تحويل هذا الموضوع إلى رسالة شخصية %{when}","split_topic":"قسَم هذا الموضوع %{when}","invited_user":"دُعي %{who} %{when}","invited_group":"دُعي %{who} %{when}","user_left":"%{who}أزال نفسه من هذه الرسالة %{when}","removed_user":"اُقصي %{who} %{when}","removed_group":"اُقصي %{who} %{when}","autobumped":"رفع مبرمج %{when}","autoclosed":{"enabled":"أُغلق %{when}","disabled":"فُتح %{when}"},"closed":{"enabled":"أغلق %{when}","disabled":"فُتح %{when}"},"archived":{"enabled":"أُرشف %{when}","disabled":"أُزال أرشفتة %{when}"},"pinned":{"enabled":"ثُبت %{when}","disabled":"أُزال تثبيته %{when}"},"pinned_globally":{"enabled":"ثُبّته عموميا %{when}","disabled":"أُزال تثبيته %{when}"},"visible":{"enabled":"أُدرج %{when}","disabled":"أُزال إدراجه %{when}"},"banner":{"enabled":"اجعل هذا إعلانا %{when}. سوف يظهر اعلى جميع الصفحات حتى يتم الغاؤه بواسطة المستخدم.","disabled":"أزل هذا الإعلان %{when}. لن يظهر بعد الآن في أعلى كلّ صفحة."}},"topic_admin_menu":"عمليات الموضوع","wizard_required":"مرحبًا في نسختك الجديدة من دسكورس! فلنبدأ مع \u003ca href='%{url}' data-auto-route='true'\u003eمُرشد الإعدادات\u003c/a\u003e ✨","emails_are_disabled":"لقد عطّل أحد المدراء الرّسائل الصادرة للجميع. لن تُرسل إشعارات عبر البريد الإلكتروني أيا كان نوعها.","bootstrap_mode_enabled":"لكى تتمكن من اطلاق موقعك الجديد بسهولة, الموقع اﻷن علي الوضع التمهيدي. كل المستخدمين الجدد سيحصلون علي مستوي الثقة 1 وسيكون خيار ارسال الملخص اليومى عن طريق البريد الالكترونى مفعل. سيتم الغاء الوضع التمهيدي تلقائيا عندما يشترك %{min_users} عضو.","bootstrap_mode_disabled":"سيتوقف الوضع التمهيدي خلال 24 ساعة.","themes":{"default_description":"افتراضى","broken_theme_alert":"قد لا يعمل موقعك لأن القالب / المكون %{theme} به أخطاء. ألغه في %{path}."},"s3":{"regions":{"ap_northeast_1":"آسيا والمحيط الهادئ (طوكيو)","ap_northeast_2":"آسيا والمحيط الهادئ ( سيول)","ap_south_1":"آسيا والمحيط الهادئ (مومباي)","ap_southeast_1":"آسيا والمحيط الهادئ (سنغافورة)","ap_southeast_2":"آسيا والمحيط الهادئ (سيدني)","ca_central_1":"كندا (وسط)","cn_north_1":"الصين (بكين)","cn_northwest_1":"الصين (نيجكسا)","eu_central_1":"الاتحاد الأوروبي (فرانكفورت)","eu_north_1":"الاتحاد الأوربي (ستوكهولم)","eu_west_1":"الاتحاد الأوروبي (أيرلندا)","eu_west_2":"الاتحاد الأوروبي (لندن)","eu_west_3":"الاتحاد الأوربي (باريس)","sa_east_1":"أمريكا الجنوبية (ساو باولو)","us_east_1":"شرق الولايات المتحدة (فرجينيا الشمالية)","us_east_2":"غرب الولايات المتحدة (اوهايو)","us_gov_east_1":"إستضافة أمازون السحابية AWS GovCloud (US-East)","us_gov_west_1":"إستضافة أمازون السحابية AWS GovCloud (US-West)","us_west_1":"غرب الولايات المتحدة (كاليفورنيا الشمالية)","us_west_2":"غرب الولايات المتحدة (أوريغون)"}},"edit":"عدل عنوان و قسم هذا الموضوع","expand":"توسيع","not_implemented":"لم تُنجز هذه الخاصية بعد، عذرا.","no_value":"لا","yes_value":"نعم","submit":"أرسل","generic_error":"نأسف، حدث عطل ما.","generic_error_with_reason":"حدث عطل ما: %{error}","go_ahead":"انطلق","sign_up":"أنشأ حسابا","log_in":"تسجل الدخول","age":"العمر","joined":"انضم في","admin_title":"المدير","show_more":"أظهر المزيد","show_help":"خيارات","links":"روابط","links_lowercase":{"zero":"الروابط","one":"الروابط","two":"الروابط","few":"الروابط","many":"الروابط","other":"روابط"},"faq":"الأسئلة الشائعة","guidelines":"القواعد العامة","privacy_policy":"سياسة الخصوصية ","privacy":"الخصوصية ","tos":"شروط الخدمة","rules":"الشروط","conduct":"قواعد السلوك","mobile_view":"نسخة الهواتف","desktop_view":"نسخة سطح المكتب","you":"انت","or":"أو","now":"منذ لحظات","read_more":"اطلع على المزيد","more":"أكثر","less":"أقل","never":"أبدا","every_30_minutes":"كل 30 دقيقة","every_hour":"كل ساعة","daily":"يوميا","weekly":"أسبوعيا","every_month":"كل شهر","every_six_months":"كل ستة اشهر","max_of_count":"أقصى عدد هو {{count}}","alternation":"أو","character_count":{"zero":"لا محارف","one":"محرف واحد","two":"محرفان","few":"{{count}} محارف","many":"{{count}} محرفا","other":"{{count}} حرف"},"related_messages":{"title":"الرسائل ذات الصلة","see_all":"شاهد \u003ca href=\"%{path}\"\u003eكل الرسائل\u003c/a\u003e من @%{username}..."},"suggested_topics":{"title":"المواضيع المقترحة","pm_title":"رسائل مقترحة "},"about":{"simple_title":"عنّا","title":"عن %{title}","stats":"إحصاءات الموقع ","our_admins":"المدراء","our_moderators":"المشرفين","moderators":"المشرفون","stat":{"all_time":"منذ التأسيس","last_7_days":"آخر 7","last_30_days":"آخر 30"},"like_count":"الإعجابات","topic_count":"المواضيع","post_count":"المنشورات","user_count":"الأعضاء","active_user_count":"الأعضاء النشطون","contact":"اتصل بنا","contact_info":"في حال حدوث مشكلة حرجة أو أمر عاجل يؤثّر على الموقع، من فضلك راسلنا على %{contact_info}."},"bookmarked":{"title":"ضع علامة مرجعية","clear_bookmarks":"أزل العلامات المرجعية","help":{"bookmark":"انقر لوضع علامة مرجعية علي أوّل منشور في هذا الموضوع","unbookmark":"انقر لإزالة كلّ العلامات المرجعية في هذا الموضوع"}},"bookmarks":{"created":"لقد وضعت علامة مرجعية علي هذا المنشور","not_bookmarked":"أشر هذا المكتوب","remove":"أزل العلامة المرجعية","confirm_clear":"هل أنت متأكد من مسح جميع الاشعارات المرجعية من هذا الموضوع؟","save":"احفظ","no_timezone":"لم تحدد منظقتك الزمنية بعد. لن تتمكن من تفعيل التذكيرات. حددها \u003ca href=\"%{basePath}/my/preferences/profile\"\u003eفي ملفك الشخصي\u003c/a\u003e.","reminders":{"at_desktop":"في المرة القادمة سأكون عند مكتبي","later_today":"في وقت لاحق اليوم","tomorrow":"غداً","next_week":"الاسبوع القادم","later_this_week":"في وقت لاحق هذا الاسبوع","next_month":"الشهر القادم"}},"drafts":{"resume":"أكمل","remove":"احذف","new_topic":"مسودة موضوع جديد","topic_reply":"مسودة الرد","abandon":{"yes_value":"نعم، لا أريده","no_value":"لا, إبقاء"}},"preview":"معاينة","cancel":"ألغِ","save":"احفظ التعديلات","saving":"يحفظ...","saved":"حُفظت!","upload":"ارفع","uploading":"يرفع...","uploaded":"رُفع!","pasting":"جاري النسخ","enable":"فعّل","disable":"عطّل","continue":"استمر","undo":"تراجع","revert":"اعكس","failed":"فشل","switch_to_anon":"ادخل وضع التّخفي","switch_from_anon":"اخرج من وضع التّخفي","banner":{"close":"تجاهل هذا الإعلان.","edit":"عدل هذا الإعلان \u003e\u003e"},"choose_topic":{"none_found":"لم نجد اي موضوعات."},"choose_message":{"none_found":"لم يتم العثور على أي رسالة"},"review":{"explain":{"total":"مجموع"},"awaiting_approval":"بأنتضار موافقة","delete":"أحذف","settings":{"saved":"تم حفظهُ","save_changes":"احفظ التعديلات","title":"إعدادات"},"moderation_history":"تاريخ الادارة","view_all":"اظهار الكل","topic":"الموضوع:","filtered_user":"مستخدم","user":{"username":"اسم المستخدم","email":"البريد الإلكتروني","name":"الإسم"},"topics":{"topic":"موضوع","details":"التفاصيل"},"edit":"عدّل","save":"احفظ","cancel":"ألغِ","filters":{"all_categories":"(جميع الأقسام)","type":{"title":"النوع"},"refresh":"تحديث","category":"تصنيف"},"scores":{"date":"التاريخ","type":"النوع"},"statuses":{"pending":{"title":"قيد الانتظار"},"rejected":{"title":"مرفوض"},"deleted":{"title":"محذوف"}},"types":{"reviewable_user":{"title":"مستخدم"}},"approval":{"title":"المنشور يحتاج موافقة","description":"لقد وصلنا منشورك ولكنة يحتاج موافقة المشرف قبل ظهورها. نرجو منك الصبر.","ok":"حسنا"}},"user_action":{"user_posted_topic":"نشر \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{topicUrl}}'\u003eالموضوع\u003c/a\u003e","you_posted_topic":"نشرت \u003ca href='{{userUrl}}'\u003eأنت\u003c/a\u003e \u003ca href='{{topicUrl}}'\u003eالموضوع\u003c/a\u003e","user_replied_to_post":"ردّ \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e على \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"رددت \u003ca href='{{userUrl}}'\u003eأنت\u003c/a\u003e على \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"ردّ \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e على \u003ca href='{{topicUrl}}'\u003eالموضوع\u003c/a\u003e","you_replied_to_topic":"رددت \u003ca href='{{userUrl}}'\u003eأنت\u003c/a\u003e على \u003ca href='{{topicUrl}}'\u003eالموضوع\u003c/a\u003e","user_mentioned_user":"أشار \u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e إلى \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"أشار \u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{user2Url}}'\u003eإليك\u003c/a\u003e","you_mentioned_user":"أشرت \u003ca href='{{user1Url}}'\u003eأنت\u003c/a\u003e إلى \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"نُشرت بواسطة\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"نُشرت بواسطتك \u003ca href='{{userUrl}}'\u003eانت\u003c/a\u003e","sent_by_user":"أرسله \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"أرسلته \u003ca href='{{userUrl}}'\u003eأنت\u003c/a\u003e"},"directory":{"filter_name":"رشّح باسم المستخدم","title":"الأعضاء","likes_given":"المعطاة","likes_received":"المتلقاة","topics_entered":"المُشاهدة","topics_entered_long":"المواضيع التي تمت مشاهدتها","time_read":"وقت القراءة","topic_count":"المواضيع","topic_count_long":"المواضيع المنشورة","post_count":"الردود","post_count_long":"الردود المنشورة","no_results":"لا نتائج.","days_visited":"الزيارات","days_visited_long":"أيام الزيارة","posts_read":"المقروءة","posts_read_long":"المنشورات المقروءة","last_updated":"اخر تحديث","total_rows":{"zero":"لا أعضاء","one":"عضو واحد","two":"عضوان","few":"%{count} أعضاء","many":"%{count} عضوًا","other":"%{count} عضو"}},"group_histories":{"actions":{"change_group_setting":"تغيير إعدادات المجموعة","add_user_to_group":"إضافة عضو","remove_user_from_group":"حذف العضو","make_user_group_owner":"تعيين كمالك","remove_user_as_group_owner":"سحب صلاحية المالك"}},"groups":{"member_added":"تم الإضافة","add_members":{"title":"أضف أعضاء","usernames":"أسماء المستخدمين"},"requests":{"reason":"سبب","accepted":"مقبول"},"manage":{"title":"إدارة","name":"الإسم","full_name":"الإسم الكامل","add_members":"إضافة أعضاء","delete_member_confirm":"إزالة '%{username}' من المجموعة '%{group}'؟","profile":{"title":"الملف الشخصي"},"interaction":{"title":"تفاعل","posting":"نشر","notification":"اشعار"},"membership":{"title":"العضوية","access":"صلاحية"},"logs":{"title":"السّجلّات","when":"متى","action":"إجراء","acting_user":"العضو المسؤول","target_user":"العضو المستهدف","subject":"الموضوع","details":"تفاصيل","from":"من","to":"إلى"}},"public_admission":"السماح للاعضاء بالانضمام إلى المجموعة بحرية (يتطلب أن تكون المجموعة مرئية للجميع )","public_exit":"السماح للأعضاء بمغادرة المجموعة بحرية","empty":{"posts":"لا منشورات من أعضاء هذه المجموعة.","members":"لا أعضاء في هذه المجموعة.","mentions":"لم يُشِر أحد إلى هذه المجموعة.","messages":"لا رسائل لهذه المجموعة.","topics":"لا موضوعات من أعضاء هذه المجموعة.","logs":"لا سجلّات لهذه المجموعة."},"add":"أضف","join":"انضم","leave":"غادر","request":"طلب","message":"رسالة","membership_request_template":"لوحة مخصص تظهر للأعضاء عندما يرسلون طلب عضوية","membership_request":{"submit":"ارسل الطلب","title":"اطلب الانضمام للمجموعة @%{group_name}","reason":"دع مدراء المجموعة يعرفون لماذا انت تنتمي لهذه المجموعة"},"membership":"العضوية","name":"الاسم","user_count":"الأعضاء","bio":"عن المجموعة","selector_placeholder":"أدخل اسم المستخدم","owner":"المالك","index":{"title":"المجموعات","all":"كل المجموعات","empty":"لا توجد مجموعات ظاهرة","owner_groups":"مجموعاتي","automatic":"تلقائي","closed":"مغلق","automatic_group":"مجموعة تلقائية","my_groups":"مجموعاتي","group_type":"نوع المجموعة","is_group_user":"عضو","is_group_owner":"المالك"},"title":{"zero":"مجموعة","one":"مجموعة","two":"مجموعتان","few":"المجموعات","many":"المجموعات","other":"المجموعات"},"activity":"النشاط","members":{"title":"الأعضاء","filter_placeholder":"اسم المستخدم","remove_member":"حذف عضو","remove_owner":"حذف كمالك","owner":"المالك"},"topics":"المواضيع","posts":"المنشورات","mentions":"الإشارات","messages":"الرسائل","notification_level":"المستوى الأفتراضي لإشعارات رسائل المجموعة","alias_levels":{"mentionable":"من يستطيع @الاشارة الى هذه المجموعة؟","messageable":"من يستطيع ارسال رسالة الى هذه المجموعة؟","nobody":"لا أحد","only_admins":"المدراء فقط","mods_and_admins":"المدراء والمشرفون فقط","members_mods_and_admins":"أعضاء المجموعة والمدراء والمشرفون فقط","everyone":"الكل"},"notifications":{"watching":{"title":"مُراقب","description":"سنرسل لك إشعارا عن كل منشور جديد في كل رسالة، وسترى عداد للردود الجديدة."},"watching_first_post":{"title":"مراقبة اول منشور"},"tracking":{"title":"مُتابع","description":"سنرسل لك إشعارا إن أشار أحد إلى @اسمك أو ردّ عليك، وستري عداد للردود الجديدة."},"regular":{"title":"عادي","description":"سنرسل لك إشعارا إن أشار أحد إليك أو ردّ عليك."},"muted":{"title":"مكتوم"}},"flair_url":"الصورة الرمزية المميزة","flair_url_placeholder":"(إختياري) عنوان الـ URL للصورة أو اسم رمز في Font Awesome","flair_bg_color":"لون خلفية الصورة الرمزية","flair_bg_color_placeholder":"(إختياري) اللون بترميز Hexadecimal","flair_color":"لون الصورة الرمزية","flair_color_placeholder":"(إختياري) اللون بترميز Hexadecimal","flair_preview_icon":"معاينة الأيقونة","flair_preview_image":"معاينة الصورة"},"user_action_groups":{"1":"الإعجابات المعطاة","2":"الإعجابات المتلقاة","3":"العلامات المرجعية","4":"المواضيع","5":"الردود","6":"الردود","7":"الإشارات","9":"الاقتباسات","11":"التعديلات","12":"العناصر المرسلة","13":"البريد الوارد","14":"قيد الانتظار"},"categories":{"all":"كل الأقسام","all_subcategories":"الكل","no_subcategory":"لا شيء","category":"تصنيف","category_list":"أعرض قائمة الأقسام","reorder":{"title":"إعادة ترتيب الأقسام","title_long":"إعادة تنظيم قائمة الأقسام","save":"حفظ الترتيب","apply_all":"تطبيق","position":"مكان"},"posts":"المنشورات","topics":"المواضيع","latest":"آخر المواضيع","latest_by":"الاحدث بـ","toggle_ordering":"تبديل التحكم في الترتيب","subcategories":"أقسام فرعية","topic_sentence":{"zero":"لا مواضيع","one":"موضوع واحد","two":"موضوعان","few":"%{count} مواضيع","many":"%{count} موضوعًا","other":"%{count} موضوع"}},"ip_lookup":{"title":"جدول عناوين الIP","hostname":"اسم المضيف","location":"الموقع الجغرافي","location_not_found":"(غير معرف)","organisation":"المنظمات","phone":"الهاتف","other_accounts":"الحسابات الأخرى بعنوان IP هذا:","delete_other_accounts":"أحذف %{count}","username":"إسم المستخدم","trust_level":"TL","read_time":"وقت القراءة","topics_entered":" مواضيع فُتحت","post_count":"# المنشورات","confirm_delete_other_accounts":"أمتأكد من حذف هذه الحسابات؟","copied":"تم النسخ"},"user_fields":{"none":"(إختر خيار )"},"user":{"said":"{{username}}:","profile":"الملف الشخصي","mute":"كتم","edit":"تعديل التفضيلات","download_archive":{"button_text":"تحميل الكل","confirm":"أمتأكد من تحميل منشوراتك؟","success":"بدأ التحميل, سيتم إعلامك برسالة عند اكتمال العملية.","rate_limit_error":"يمكن تنزيل المنشورات مرة واحدة يوميا فقط. رجاء أعد المحاولة غدًا."},"new_private_message":"رسالة جديدة","private_message":"رسالة خاصة","private_messages":"الرسائل","user_notifications":{"ignore_duration_username":"اسم المستخدم","ignore_duration_save":"تجاهل","mute_option":"مكتومة","normal_option":"عادي"},"activity_stream":"النّشاط","preferences":" التّفضيلات","feature_topic_on_profile":{"save":"احفظ","clear":{"title":"مسح"}},"profile_hidden":"البيانات العامة للعضو مخفية","expand_profile":"توسيع","collapse_profile":"إخفاء","bookmarks":"العلامات المرجعية","bio":"معلومات عنّي","timezone":"المنطقة الزمنية","invited_by":"مدعو بواسطة","trust_level":"مستوى الثقة","notifications":"الإشعارات","statistics":"الأحصائيات","desktop_notifications":{"label":"الإشعارات الحية","not_supported":"نأسف، لا يدعم المتصفّح الإشعارات.","perm_default":"فعّل الإشعارات","perm_denied_btn":"رُفض التّصريح","perm_denied_expl":"لقد رفضت تصريح عرض الإشعارات. اسمح بظهور الإشعارات من إعدادات المتصفّح.","disable":"عطّل الإشعارات","enable":"فعّل الإشعارات","each_browser_note":"ملاحظة: عليك تغيير هذا الإعداد في كل متصفح تستخدمه.","consent_prompt":"هل تريد إشعارات مباشرة عندما يرد الأشخاص على مشاركاتك؟"},"dismiss":"تجاهل","dismiss_notifications":"تجاهل الكل","dismiss_notifications_tooltip":"اجعل كل الإشعارات مقروءة","first_notification":"إشعارك الأول! قم بالضغط عليه للبدء.","external_links_in_new_tab":"فتح الروابط الخارجية في تبويب جديد","enable_quoting":"فعل خاصية إقتباس النصوص المظللة","change":"غيّر","moderator":"{{user}} هو مشرف","admin":"{{user}} هو مدير","moderator_tooltip":"هذا المستخدم مشرف","admin_tooltip":"هذا المستخدم مدير","suspended_notice":"هذا المستخدم موقوف حتى تاريخ {{date}}","suspended_permanently":"هذا العضو موقوف.","suspended_reason":"السبب:","github_profile":"Github","email_activity_summary":"ملخص النشاط","mailing_list_mode":{"label":"وضع القائمة البريدية","enabled":"فعّل وضع القائمة البريدية","instructions":"يطغي هذا الخيار علي خيار \"ملخص الأنشطة\".\u003cbr /\u003e\nهذه الرسائل لا تشمل الموضوعات و الأقسام المكتومة.\n","individual":"أرسل لي رسالة لكل منشور جديد","individual_no_echo":"أرسل رسالة لكل منشور جديد عدا منشوراتي","many_per_day":"أرسل لي رسالة لكل منشور جديد (تقريبا {{dailyEmailEstimate}} يوميا)","few_per_day":"أرسل لي رسالة لكل منشور جديد (تقريبا إثنتان يوميا)"},"tag_settings":"الأوسمة","watched_tags":"مراقب","watched_tags_instructions":"ستراقب آليا كل المواضيع التي تستخدم هذه الأوسمة. ستصلك إشعارات بالمنشورات و الموضوعات الجديدة، وسيظهر أيضا عدّاد للمنشورات الجديدة بجانب كل موضوع.","tracked_tags":"متابع","tracked_tags_instructions":"ستتابع آليا كل الموضوعات التي تستخدم هذه الأوسمة. وسيظهر أيضا عدّاد للمنشورات الجديدة بجانب كل موضوع.","muted_tags":"مكتوم","muted_tags_instructions":"لن يتم إشعارك بأي جديد بالموضوعات التي تستخدم هذه الأوسمة، ولن تظهر موضوعات هذه الوسوم في قائمة الموضوعات المنشورة مؤخراً.","watched_categories":"مراقب","watched_categories_instructions":"ستراقب آليا كل موضوعات هذا القسم. ستصلك إشعارات بالمنشورات و الموضوعات الجديدة، وسيظهر أيضا عدّاد للمنشورات الجديدة بجانب كل موضوع.","tracked_categories":"متابع","tracked_categories_instructions":"ستتابع آليا كل موضوعات هذا القسم. وسيظهر أيضا عدّاد للمنشورات الجديدة بجانب كل موضوع.","watched_first_post_categories":"مراقبة أول منشور","watched_first_post_categories_instructions":"سيصلك إشعار بأول منشور في كل موضوع بهذا القسم.","watched_first_post_tags":"مراقبة أول منشور","watched_first_post_tags_instructions":"سيصلك إشعار بأول منشور في كل موضوع يستخدم هذة الأوسمة.","muted_categories":"مكتوم","no_category_access":"كمشرف لديك صلاحيات وصول محدودة للأقسام, الحفظ معطل","delete_account":"أحذف الحسابي","delete_account_confirm":"أمتأكّد من حذف حسابك للأبد؟ هذا إجراء لا عودة فيه!","deleted_yourself":"حُذف حسابك بنجاح.","unread_message_count":"الرسائل","admin_delete":"أحذف","users":"الأعضاء","muted_users":"المكتومون","muted_users_instructions":"تجاهل الإشعارات من هؤلاء الأعضاء.","tracked_topics_link":"إظهار","automatically_unpin_topics":"ألغِ تثبيت الموضوعات آليا عندما أصل إلى آخرها.","apps":"تطبيقات","revoke_access":"سحب صلاحيات الوصول","undo_revoke_access":"ايقاف سحب صلاحيات الوصول","api_approved":"موافق عليه:","theme":"الواجهة","home":"الصفحة الرئيسية الافتراضية","staff_counters":{"flags_given":"البلاغات المفيدة","flagged_posts":"المنشورات المبلغ عنها ","deleted_posts":"المنشورات المحذوفة","suspensions":"موقوفون","warnings_received":"تحذيرات"},"messages":{"all":"الكل","inbox":"الوارد","sent":"الصّادر","archive":"الأرشيف","groups":"مجموعاتي","bulk_select":"حدد الرسائل","move_to_inbox":"الذهاب إلى الرسائل الواردة","move_to_archive":"الارشيف","failed_to_move":"فشل في نقل الرسائل المحددة (ربما يكون اتصالك ضعيفاً)","select_all":"تحديد الكل","tags":"الأوسمة"},"preferences_nav":{"account":"الحساب","profile":"الملف الشخصي","emails":"البريد الإلكتروني","notifications":"التنبيهات","categories":"الأقسام","users":"الأعضاء","tags":"الأوسمة","interface":"واجهة المستخدم","apps":"التطبيقات"},"change_password":{"success":"(تم إرسال الرسالة)","in_progress":"(يتم إرسال الرسالة)","error":"(خطأ)","action":"ارسل رسالة إعادة تعيين كلمة المرور","set_password":" إعادة تعين كلمة المرور","choose_new":"اختر كلمة المرور الجديدة","choose":"اختر كلمة المرور"},"second_factor_backup":{"regenerate":"إعادة إنشاء","disable":"عطل","enable":"فعل","copied_to_clipboard":"تم نسخه الى لوحة العمل","copy_to_clipboard_error":"خطأ في نسخ البيانات الى لوحة العمل"},"second_factor":{"name":"الإسم","label":"كود","disable_description":"يرجى ادخال رمز التوثيق من التطبيق الخاص بك","show_key_description":"أضف يدويا","short_description":"قم بحماية الحساب الخاص بك مع رمز الامان ذو الاستخدام الواحد.\n","oauth_enabled_warning":"يرجى الملاحظة ان تسجيل الدخول عن طريق حسابات مواقع التواصل الاجتماعي سيتم تعطيلها بمجرد تفعيل خاصية التوثيق بعاملين الحساب","edit":"عدّل","security_key":{"delete":"أحذف"}},"change_about":{"title":"تعديل عني","error":"حدث عطل أثناء تغيير هذه القيمة."},"change_username":{"title":"تغيير اسم المستخدم","taken":"عذرا، اسم المستخدم غير متاح.","invalid":"اسم المستخدم غير صالح. يمكنه احتواء احرف و ارقام انجليزية فحسب"},"change_email":{"title":"غيّر البريد الإلكتروني","taken":"عذرا، البريد الإلكتروني غير متوفر.","error":"حدث عطل أثناء تغيير البريد الإلكتروني. ربما هناك من يستخدم هذا العنوان بالفعل؟","success":"لقد أرسلنا بريد إلكتروني إلى هذا العنوان. من فضلك اتّبع تعليمات التأكيد.","success_staff":"لقد قمنا بأرسال بريدا إلكتروني الى عنوانك الحالي, رجاء اتبع تعليمات التأكيد."},"change_avatar":{"title":"غيّر صورة الملفك الشخصي","letter_based":"صورة الملف الشخصي الافتراضية","uploaded_avatar":"صورة مخصصة","uploaded_avatar_empty":"اضافة صورة مخصصة","upload_title":"ارفع صورتك ","image_is_not_a_square":"تحذير: لقد قصصنا صورتك، لأن عرضها وارتفاعها غير متساويان."},"change_card_background":{"title":"خلفية بطاقة العضو","instructions":"سيتم وضع صورة الخلفية في المنتصف بعرض 590px"},"email":{"title":"البريد الإلكتروني","ok":"سنرسل لك بريدا للتأكيد","invalid":"من فضلك أدخل بريدا إلكترونيا صالحا","authenticated":"تم توثيق بريدك الإلكتروني بواسطة {{provider}}","frequency_immediately":"سيتم ارسال رسالة الكترونية فورا في حال أنك لم تقرأ الرسائل السابقة التي كنا نرسلها لك.","frequency":{"zero":"سنراسلك على بريدك فقط في حال لم تزر الموقع منذ {{count}} دقيقة.","one":"سنراسلك على بريدك فقط في حال لم تزر الموقع منذ {{count}} دقيقة.","two":"سنراسلك على بريدك فقط في حال لم تزر الموقع منذ {{count}} دقيقة.","few":"سنراسلك على بريدك فقط في حال لم تزر الموقع منذ {{count}} دقيقة.","many":"سنراسلك على بريدك فقط في حال لم تزر الموقع منذ {{count}} دقيقة.","other":"سنراسلك على بريدك فقط في حال لم تزر الموقع منذ {{count}} دقيقة."}},"associated_accounts":{"revoke":"تعطيل","cancel":"ألغِ"},"name":{"title":"الاسم","instructions":"اسمك الكامل (اختياريّ)","instructions_required":"اسمك كاملا","too_short":"اسمك قصير جدا","ok":"يبدو اسمك جيدا"},"username":{"title":"اسم المستخدم","instructions":"باللغة الإنجليزية و دون مسافات و قصير و غير مكرر","short_instructions":"يمكن للغير الإشارة إليك ب‍@{{username}}","available":"اسم المستخدم متاح","not_available":"غير متاح. جرّب {{suggestion}} ؟","not_available_no_suggestion":"غير متاح","too_short":"اسم المستخدم قصير جدًّا","too_long":"اسم المستخدم طويل جدًّا","checking":"يتم التاكد من توفر اسم المستخدم...","prefilled":"البريد الالكتروني مطابق لـ اسم المستخدم المسّجل."},"locale":{"title":"لغة الواجهة","instructions":"لغة واجهة المستخدم. ستتغيّر عندما تحدث الصفحة.","default":"(الافتراضية)","any":"أي"},"password_confirmation":{"title":"أعد كتابة كلمة المرور"},"auth_tokens":{"ip":"IP","details":"تفاصيل"},"last_posted":"آخر منشور","last_emailed":"اخر ما تم ارساله","last_seen":"كان هنا","created":"انضم","log_out":"سجل خروج","location":"الموقع الجغرافي","website":"الموقع الكتروني","email_settings":"البريد الإلكتروني","text_size":{"normal":"عادي"},"like_notification_frequency":{"title":"أرسل إشعارا عند الإعجاب","always":"دوما","first_time_and_daily":"أول إعجاب بالمنشور يوميا","first_time":"أول إعجاب بالمنشور","never":"أبدا"},"email_previous_replies":{"title":"ضع الردود السابقة في نهاية الرسائل الإلكترونية","unless_emailed":"في حال لم تُرسل","always":"دائما","never":"أبدا"},"email_digests":{"every_30_minutes":"كل 30 دقيقة","every_hour":"كل ساعة","daily":"يوميا","weekly":"أسبوعيا","every_month":"كل شهر","every_six_months":"كل ستة اشهر"},"email_level":{"title":"أرسل إليّ رسائل إلكترونية عندما يقتبس أحد كلامي، أو يرد على إحدى منشوراتي، أو يشير إلي @اسمي أو يدعوني إلى أحد الموضوعات","always":"دائما","never":"أبدا"},"email_messages_level":"أرسل إلي رسالة إلكترونية عندما يبعث أحدهم رسالة إلي","include_tl0_in_digests":"ارفق محتوى الاعضاء الجدد في رسائل الملخص","email_in_reply_to":"ارفق مقتطف من الرد على الموضوع في رسائل البريد الالكتروني","other_settings":"أخرى","categories_settings":"التصنيفات","new_topic_duration":{"label":"اعتبر الموضوعات جديدة لو","not_viewed":"لم أطالعها بعد","last_here":"تم إنشائها منذ اخر زيارة لي. ","after_1_day":"أُنشئت في اليوم الماضي","after_2_days":"أُنشئت في اليومين الماضيين","after_1_week":"أُنشئت في الأسبوع الماضي","after_2_weeks":"أُنشئت في الأسبوعين الماضيين"},"auto_track_topics":"تابع آليا الموضوعات التي افتحها","auto_track_options":{"never":"أبدًا","immediately":"حالًا","after_30_seconds":"بعد 30 ثانية","after_1_minute":"بعد دقيقة واحدة","after_2_minutes":"بعد دقيقتين","after_3_minutes":"بعد ثلاث دقائق","after_4_minutes":"بعد اربع دقائق","after_5_minutes":"بعد خمس دقائق","after_10_minutes":"بعد 10 دقائق"},"notification_level_when_replying":"إذا نشرت في موضوع ما، اجعله","invited":{"search":"اكتب للبحث عن الدعوات...","title":"الدّعوات","user":"المستخدمين المدعويين","truncated":{"zero":"لا يوجد دعوات لعرضها.","one":"عرض الدعوة الأولى.","two":"عرض الدعوتان الأولتان.","few":"عرض الدعوات الأولية.","many":"عرض الدعوات {{count}} الأولى.","other":"عرض الدعوات {{count}} الأولى."},"redeemed":"دعوات محررة","redeemed_tab":"محررة","redeemed_tab_with_count":"({{count}}) محررة","redeemed_at":"محررة","pending":"دعوات قيد الإنتضار","pending_tab":"قيد الانتظار","pending_tab_with_count":"معلق ({{count}})","topics_entered":" موضوعات شُوهِدت","posts_read_count":"منشورات قرات","expired":"الدعوة انتهت صلاحيتها ","rescind":"حذف","rescinded":"الدعوة حذفت","reinvite":"اعادة ارسال الدعوة","reinvite_all":"أعد إرسال كل الدعوات","reinvite_all_confirm":"هل انت متأكد من رغبتك في اعادة ارسال كل الدعوات؟","reinvited":"اعادة ارسال الدعوة","reinvited_all":"كل الدعوات تمت اعادة ارسالها","time_read":"وقت القراءة","days_visited":"أيام الزيارة","account_age_days":"عمر الحساب بالأيام","create":"أرسل دعوة","generate_link":"انسخ رابط الدعوة","link_generated":"وُلّد رابط الدعوة بنجاح!","valid_for":"رابط الدعوة صالح للبريد الإلكترونيّ هذا فقط: %{email}","bulk_invite":{"none":"لم تدعُ أحدًا إلى هنا بعد. أرسل الدّعوات إمّا فرديّة، أو إلى مجموعة أشخاص عبر \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eرفع ملفّ CSV\u003c/a\u003e.","text":"دعوة جماعية بواسطة ملف","success":"رُفع الملف بنجاح. سيصلك إشعارا عبر رسالة عند اكتمال العملية.","error":"عذرا، يجب أن يكون الملفّ بنسق CSV."}},"password":{"title":"كلمة المرور","too_short":"كلمة المرور قصيرة جدًّا.","common":"كلمة المرور هذه شائعة.","same_as_username":"كلمة المرور تطابق اسم المستخدم.","same_as_email":"كلمة المرور تطابق البريد الإلكتروني.","ok":"تبدو كلمة المرور جيّدة.","instructions":"علي الأقل %{count} حرفا"},"summary":{"title":"ملخص","stats":"إحصائيات","time_read":"وقت القراءة","recent_time_read":"وقت القراءة الحديث","topic_count":{"zero":"عدد المواضيع المنشأة","one":"عدد المواضيع المنشأة","two":"عدد المواضيع المنشأة","few":"عدد المواضيع المنشأة","many":"عدد المواضيع المنشأة","other":"عدد المواضيع المنشأة"},"post_count":{"zero":"المنشورات المنشأة","one":"المنشورات المنشأة","two":"المنشورات المنشأة","few":"المنشورات المنشأة","many":"المنشورات المنشأة","other":"المنشورات المنشأة"},"days_visited":{"zero":"أيّام الزّيارة","one":"أيّام الزّيارة","two":"أيّام الزّيارة","few":"أيّام الزّيارة","many":"أيّام الزّيارة","other":"أيام الزيارة"},"posts_read":{"zero":"المنشورات المقروءة","one":"المنشورات المقروءة","two":"المنشورات المقروءة","few":"المنشورات المقروءة","many":"المنشورات المقروءة","other":"المنشورات المقروءة"},"bookmark_count":{"zero":"العلامات المرجعية","one":"العلامات المرجعية","two":"العلامات المرجعية","few":"العلامات المرجعية","many":"العلامات المرجعية","other":"العلامات المرجعية"},"top_replies":"أفضل الردود","no_replies":"لا يوجد ردود بعد.","more_replies":"ردود أخرى","top_topics":"أفضل الموضوعات","no_topics":"لا يوجد موضوعات بعد.","more_topics":"موضوعات أخرى","top_badges":"أفضل الشارات","no_badges":"لا يوجد شارات بعد.","more_badges":"شارات أخرى","top_links":"أفضل الروابط","no_links":"لا يوجد روابط بعد.","most_liked_by":"أكثر المعجبين به","most_liked_users":"أكثر من أعجبه","most_replied_to_users":"أكثر من رد عليه","no_likes":"لا يوجد إعجابات بعد.","top_categories":"أفضل التصنيفات","topics":"المواضيع","replies":"الردود"},"ip_address":{"title":"عنوان IP الأخير"},"registration_ip_address":{"title":"عنوان IP التسجيل"},"avatar":{"title":"صورة الملف الشخصي","header_title":"الملف الشخصي و الرسائل و العلامات المرجعية و التفضيلات"},"title":{"title":"عنوان"},"primary_group":{"title":"المجموعة الأساسية"},"filters":{"all":"الكل"},"stream":{"posted_by":"نُشرت بواسطة","sent_by":" أرسلت بواسطة","private_message":"رسالة","the_topic":"الموضوع"}},"loading":"يتم التحميل...","errors":{"prev_page":"اثناء محاولة التحميل","reasons":{"network":"خطأ في الشبكة","server":"خطأ في الخادم","forbidden":"الوصول غير مصرح","unknown":"خطأ","not_found":"الصفحة غير متوفرة"},"desc":{"network":"من فضلك تحقق من اتصالك.","network_fixed":"أنت الآن متصل بالانترنت","server":"رمز الخطأ: {{status}}","forbidden":"ليس مسموحًا لك عرض هذا.","not_found":"اوو! حاول التّطبيق تحميل عنوان غير موجود.","unknown":"حدث خطب ما."},"buttons":{"back":"الرجوع","again":"أعد المحاولة","fixed":"حمل الصفحة"}},"modal":{"close":"أغلق"},"close":"اغلق","assets_changed_confirm":"حُدث الموقع لتوّه. أتريد تحديث الصفحة ورؤية أحدث إصدار؟","logout":"لقد سجلت خروج.","refresh":"تحديث","read_only_mode":{"enabled":"هذا الموقع في وضع القراءة فقط. نأمل أن تتابع تصفحه، ولكن الرد، والإعجاب وغيرها من الصلاحيات معطلة حاليا.","login_disabled":"تسجيل الدخول معطل في حال كان الموقع في وضع القراءة فقط.","logout_disabled":"تسجيل الخروج معطّل في حال كان الموقع في وضع القراءة فقط."},"learn_more":"اطّلع على المزيد...","all_time":"المجموع","all_time_desc":"عدد المواضيع المنشأة","year":"عام","year_desc":"المواضيع المكتوبة خلال 365 يوم الماضية","month":"شهر","month_desc":"المواضيع المكتوبة خلال 30 يوم الماضية","week":"أسبوع","week_desc":" المواضيع التي كتبت خلال 7 أيام الماضية","day":"يوم","first_post":"أوّل منشور","mute":"كتم","unmute":"إلغاء الكتم","last_post":"المُرسَلة","time_read":"المقروءة","last_reply_lowercase":"آخر رد","replies_lowercase":{"zero":"الردود","one":"الردود","two":"الردود","few":"الردود","many":"الردود","other":"الردود"},"signup_cta":{"sign_up":"إنشاء حساب","hide_session":"ذكرني غدا","hide_forever":"لا شكرا","hidden_for_session":"لا بأس، سأسلك غدًا. يمكنك دوما استخدام 'تسجيل الدخول' لإنشاء حساب ايضا."},"summary":{"enabled_description":"أنت تطالع ملخّصًا لهذا الموضوع، أي أكثر المنشورات الجديرة بالاهتمام حسب نظرة المجتمع.","description":"هناك \u003cb\u003e{{replyCount}}\u003c/b\u003e من الردود.","description_time":"هناك \u003cb\u003e{{replyCount}}\u003c/b\u003e من الردود، ووقت القراءة المتوقّع هو \u003cb\u003e{{readingTime}} من الدّقائق\u003c/b\u003e.","enable":"لخّص هذا الموضوع","disable":"أظهر كل المشاركات"},"deleted_filter":{"enabled_description":"في هذا الموضوع مشاركات محذوفة قد أُخفيت.","disabled_description":"المشاركات المحذوفة في الموضوع معروضة.","enable":"أخفِ المشاركات المحذوفة","disable":"أظهر المشاركات المحذوفة"},"private_message_info":{"title":"رسالة","remove_allowed_user":"أمتأكّد من إزالة {{name}} من هذه الرّسالة؟","remove_allowed_group":"أمتأكّد من إزالة {{name}} من هذه الرّسالة؟"},"email":"البريد الإلكتروني","username":"اسم المستخدم","last_seen":"كان هنا","created":"انشات","created_lowercase":"انشات","trust_level":"مستوى الثقة","search_hint":"اسم المستخدم أو البريد إلكتروني أو عنوان الـ IP","create_account":{"title":"إنشاء حساب جديد","failed":"حدث خطب ما. لربّما يكون البريد الإلكتروني مسجلًا بالفعل. جرب رابط نسيان كلمة المرور"},"forgot_password":{"title":" إعادة تعيين كلمة المرور","action":"نسيتُ كلمة المرور","invite":"أدخل اسم المستخدم أو البريد الإلكتروني وسنرسل بريدًا لإعادة تعيين كلمة المرور.","reset":" إعادة تعين كلمة المرور","complete_username":"إن تطابق حساب ما مع اسم المستخدم \u003cb\u003e%{username}\u003c/b\u003e، يفترض أن تستلم قريبًا بريدًا به إرشادات إعادة تعيين كلمة المرور.","complete_email":"إن تطابق حساب ما مع \u003cb\u003e%{email}\u003c/b\u003e، يفترض أن تستلم قريبًا بريدًا به إرشادات إعادة تعيين كلمة المرور.","complete_username_not_found":"لا يوجد حساب يطابق اسم المستخدم \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"لا حساب يطابق \u003cb\u003e%{email}\u003c/b\u003e","help":"لم يصل البريد؟ تفحص مجلد السبام\u003cp\u003eلست متأكداً اي عنوان بريد الكتروني قمت بأستخدامة؟ قم بأدخال عنوان البريد الالكتروني و سنعلمك ان كان موجوداً هنا\u003c/p\u003e\u003cp\u003e ان لم يعد بأمكانك الوصول الى البريد الالكتروني في حسابك, رجاء اتصل بـ \u003ca href='%{basePath}/about'\u003eطاقم الدعم الخاص بنا\u003c/a\u003e\u003c/p\u003e","button_ok":"حسنا","button_help":"مساعدة"},"email_login":{"button_label":"مع البريد الإلكتروني","complete_username_not_found":"لا يوجد حساب يطابق اسم المستخدم \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"لا حساب يطابق \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"تابع إلى %{site_name}"},"login":{"title":"تسجيل دخول","username":"اسم المستخدم","password":"كلمة المرور","email_placeholder":"البريد الإلكتروني أو اسم المستخدم","caps_lock_warning":"مفتاح Caps Lock مفعّل","error":"خطأ مجهول","rate_limit":"رجاء انتظر قبل تسجيل دخول مرة أخرى.","blank_username_or_password":"رجاء أدخل اسم المستخدم أو البريد الإلكتروني و كلمة المرور.","reset_password":"اعد تعيين كلمة المرور","logging_in":"تسجيل دخول...","or":"أو ","authenticating":"يوثق...","awaiting_activation":"ما زال حسابك غير مفعّل، استخدم رابط نسيان كلمة المرور لإرسال بريد إلكتروني تفعيلي آخر.","awaiting_approval":"لم يوافق أي من أعضاء طاقم العمل على حسابك بعد. سيُرسل إليك بريد إلكتروني حالما يتمّ ذلك.","requires_invite":"عذرا، الدخول لهذا الموقع خاص بالمدعويين فقط.","not_activated":"لا يمكنك تسجيل دخول بعد. لقد أرسلنا سابقًا بريدًا إلى \u003cb\u003e{{sentTo}}\u003c/b\u003e. رجاء اتّبع الإرشادات فيه لتفعيل حسابك.","not_allowed_from_ip_address":"لا يمكنك تسجيل دخول من عنوان IP هذا.","admin_not_allowed_from_ip_address":"لا يمكنك تسجيل دخول كمدير من عنوان IP هذا.","resend_activation_email":"انقر هنا لإرسال رسالة التفعيل مرّة أخرى.","resend_title":"اعد ارسال رسالة التفعيل","change_email":"غير عنوان البريد الالكتروني","provide_new_email":"ادخل عنوان بريد الكتروني جديد و سنقوم بأرسال لك بريد التأكيد.","submit_new_email":"حدث عنوان البريد الإلكتروني","sent_activation_email_again":"لقد أرسلنا بريد تفعيل آخر إلى \u003cb\u003e{{currentEmail}}\u003c/b\u003e. قد يستغرق وصوله بضعة دقائق. تحقّق من مجلّد السبام.","to_continue":"رجاء سجل دخول","preferences":"عليك تسجل الدخول لتغيير تفضيلاتك الشخصية.","forgot":"لا أتذكر معلومات حسابي","not_approved":"لم تتمّ الموافقة على حسابك بعد. سيصلك إشعار عبر البريد عندما تكون مستعدا لتسجيل الدخول.","google_oauth2":{"name":"غوغل","title":"عبر Google "},"twitter":{"name":"Twitter","title":"عبر Twitter"},"instagram":{"title":"عبر Instagram"},"facebook":{"title":"عبر Facebook"},"github":{"title":"عبر GitHub"}},"invites":{"accept_title":"دعوة","welcome_to":"مرحباً بك في %{site_name}!","invited_by":"لقد دعاك:","social_login_available":"يمكنك أيضا تسجيل الدخول عبر أي شبكة اجتماعية مستخدما هذا البريد.","your_email":"البريد الالكتروني الخاص بحسابك هو \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"قُبول الدعوة ","success":"تم إنشاء حسابك و تسجيل دخولك للموقع","name_label":"الإسم","password_label":"حدد كلمة المرور","optional_description":"(إختياري)"},"password_reset":{"continue":"تابع نحو %{site_name}"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"الأقسام فقط","categories_with_featured_topics":"أقسام ذات مواضيع مُميزة","categories_and_latest_topics":"الأقسام والمواضيع الأخيرة"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"conditional_loading_section":{"loading":"يتم التحميل..."},"select_kit":{"default_header_text":"اختر...","no_content":"لا يوجد نتائج مطابقة","filter_placeholder":"بحث...","filter_placeholder_with_any":"ابحث أو أنشئً ..."},"date_time_picker":{"from":"من","to":"إلى"},"emoji_picker":{"filter_placeholder":"بحث عن الرموز التعبيرية","objects":"اشياء","flags":"الأبلاغ","recent":"تم استخدامه مؤخراً","default_tone":"لون البشرة إفتراضي","light_tone":"لون البشرة أبيض","medium_light_tone":"لون البشرة قمحي","medium_tone":"لون بشرة اسمر","medium_dark_tone":"لون البشرة اسمر قاتم","dark_tone":"لون البشرة داكن","default":"الرموز التعبيرية المخصصة"},"composer":{"emoji":"الرموز التعبيرية :)","more_emoji":"أكثر...","options":"خيارات","whisper":"همس","unlist":"غير مدرج","blockquote_text":"اقتبس الفقرة","add_warning":"هذا تحذير رسمي.","toggle_whisper":"تبديل الهمس","toggle_unlisted":"تبديل الغير مدرج","posting_not_on_topic":"أي موضوع تود الرد عليه؟","saved_local_draft_tip":"حُفظ محليا","similar_topics":"موضوعك يشابه...","drafts_offline":"مسودات محفوظة ","group_mentioned":{"zero":"الإشارة إلى {{group}} تعني \u003ca href='{{group_link}}'\u003eعدم إخطار أحد\u003c/a\u003e. أمتأكّد؟","one":"الإشارة إلى {{group}} تعني إخطار \u003ca href='{{group_link}}'\u003eشخص واحد\u003c/a\u003e. أمتأكّد؟","two":"الإشارة إلى {{group}} تعني إخطار \u003ca href='{{group_link}}'\u003eشخصين\u003c/a\u003e. أمتأكّد؟","few":"الإشارة إلى {{group}} تعني إخطار \u003ca href='{{group_link}}'\u003e{{count}} أشخاص\u003c/a\u003e. أمتأكّد؟","many":"الإشارة إلى {{group}} تعني إخطار \u003ca href='{{group_link}}'\u003e{{count}} شخصًا\u003c/a\u003e. أمتأكّد؟","other":"بالإشارة إلى {{group}} تعني إشعار\u003ca href='{{group_link}}'\u003e{{count}} شخص\u003c/a\u003e– أمتأكد من ذلك؟"},"cannot_see_mention":{"category":"لقد قمت بالإشارة إلي {{username}} لكن لن يتم إشعارهم لأن ليس لديهم صلاحية الوصول لهذا القسم. عليك ان تقوم باضافتهم لمجموعة لديها حق الوصول لهذا القسم.","private":"لقد قمت بالإشارة إلي {{username}} لكن لن يتم إشعارهم لأن ليس لديهم صلاحية الوصول لهذه الرسالة الخاصة. عليك ان تقوم باضافتهم إلي هذة الرسالة."},"duplicate_link":"يبدوا ان هذا الرابط \u003cb\u003e{{domain}}\u003c/b\u003e تم ذكرة فعلا في الموضوع من قبل \u003cb\u003e@{{username}}\u003c/b\u003e في \u003ca href='{{post_url}}'\u003eرد منذ {{ago}}\u003c/a\u003e – هل انت متاكد انك تريد نشرة مرة اخري؟","error":{"title_missing":"العنوان مطلوب","title_too_short":"العنوان يجب أن يكون علي الاقل {{min}} حرف","title_too_long":"العنوان يجب أن لا يزيد عن {{max}} حرف","post_length":"المنشور يجب أن يكون علي الاقل {{min}} حرف","category_missing":"يجب عليك إختيار احد الأقسام"},"save_edit":"أحفظ التعديل","reply_original":"التعليق على الموضوع الأصلي","reply_here":"الرد هنا","reply":"الرد","cancel":"إلغاء","create_topic":"إنشاء موضوع","create_pm":"رسالة","title":"أو اضغط Ctrl+Enter","users_placeholder":"أضف عضوا","title_placeholder":"بجملة واحدة، صف ما الذي تود المناقشة فية؟","title_or_link_placeholder":"اكتب عنوانًا أو ألصق رابطًا","edit_reason_placeholder":"لماذا تقوم بالتعديل؟","topic_featured_link_placeholder":"ضع رابطاً يظهر مع العنوان","remove_featured_link":"حذف الرابط من الموضوع","reply_placeholder":"اكتب ما تريد هنا. استخدم Markdown، أو BBCode، أو HTML للتنسيق. اسحب الصور أو ألصقها.","view_new_post":"شاهد منشورك الجديد.","saving":"يحفظ","saved":"حُفظ!","uploading":"يرفع...","show_preview":"أظهر المعاينة \u0026raquo;","hide_preview":"\u0026laquo; أخفِ المعاينة","quote_post_title":"اقتبس كامل المشاركة","bold_label":"B","bold_title":"عريض","bold_text":"نص عريض","italic_label":"I","italic_title":"مائل","italic_text":"نص مائل","link_title":"رابط","link_description":"ادخل وصف الرابط هنا ","link_dialog_title":"اضف الرابط","link_optional_text":"عنوان اختياري","quote_title":"اقتباس فقرة","quote_text":"اقتباس فقرة","code_title":"المحافظة على التنسيق","code_text":"اضف 4 مسافات اول السطر قبل النص المنسق","paste_code_text":"اكتب أو الصق الكود هنا","upload_title":"رفع","upload_description":"ادخل وصف الرفع هنا","olist_title":"قائمة مرقمة","ulist_title":"قائمة نقطية","list_item":"قائمة العناصر","help":"مساعدة في رموز التنسيق","modal_ok":"حسنا","modal_cancel":"إلغاء","cant_send_pm":"نأسف، لا يمكنك إرسال الرسائل إلى %{username}.","yourself_confirm":{"title":"أنسيت إضافة المستلمين؟","body":"حاليا هذة الرسالة مرسلة اليك فقط!"},"admin_options_title":"إعدادات طاقم العمل الاختيارية لهذا الموضوع","composer_actions":{"reply":"رد","edit":"عدّل","create_topic":{"label":"موضوع جديد"}},"details_title":"ملخص","details_text":"سيتم إخفاء هذا النص"},"notifications":{"title":"إشعارات الإشارة إلى @اسمك، والردود على موضوعاتك و منشوراتك ، والرسائل، وغيرها","none":"تعذّر تحميل الإشعارات الآن.","empty":"لا إشعارات.","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}} ","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}} ","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}} ","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}} ","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}} ","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}} ","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}} ","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"zero":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","one":"\u003cspan\u003e{{username}}, {{username2}} و وواحد اخر\u003c/span\u003e {{description}}","two":"\u003cspan\u003e{{username}}, {{username2}} و اثنين اخرون\u003c/span\u003e {{description}}","few":"\u003cspan\u003e{{username}}, {{username2}} و {{count}} اخرون\u003c/span\u003e {{description}}","many":"\u003cspan\u003e{{username}}, {{username2}} و {{count}} اخرون\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} و {{count}} اخرون\u003c/span\u003e {{description}}"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}} ","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e قبل دعوتك","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e نقل {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}} ","granted_badge":"تم منحك شارة '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}} ","watching_first_post":"\u003cspan\u003eموضوع جديد\u003c/span\u003e {{description}}","group_message_summary":{"zero":"لا يوجد رسائل في صندوق رسائل {{group_name}} ","one":"رسالة واحدة في صندوق رسائل {{group_name}} ","two":"{{count}} رسالة في صندوق رسائل {{group_name}} ","few":"{{count}} رسالة في صندوق رسائل {{group_name}} ","many":"{{count}} رسالة في صندوق رسائل {{group_name}} ","other":"{{count}} رسالة في صندوق رسائل {{group_name}} "},"popup":{"mentioned":"أشار {{username}} إليك في \"{{topic}}\" - {{site_title}}","group_mentioned":"أشار {{username}} إليك في \"{{topic}}\" - {{site_title}}","quoted":"اقتبس {{username}} كلامك في \"{{topic}}\" - {{site_title}}","replied":"ردّ {{username}} عليك في \"{{topic}}\" - {{site_title}}","posted":"نشر {{username}} في \"{{topic}}\" - {{site_title}}","linked":"{{username}} وضع رابطا لمنشورك في \"{{topic}}\" - {{site_title}}"},"titles":{"watching_first_post":"موضوع جديد"}},"upload_selector":{"title":"أضف صورة","title_with_attachments":"أضف صورة أو ملفّ","from_my_computer":"من جهازي","from_the_web":"من الوبّ","remote_tip":"رابط لصورة","remote_tip_with_attachments":"رابط لصورة أو ملف {{authorized_extensions}}","local_tip":"إختر صور من جهازك .","local_tip_with_attachments":"حدّد صورا أو ملفات من جهازك {{authorized_extensions}}","hint":"(يمكنك أيضا السحب والإفلات في المحرر لرفعها)","hint_for_supported_browsers":"يمكنك أيضا سحب وإفلات الصور أو لصقها في المحرر","uploading":"يرفع","select_file":"اختر ملفا","default_image_alt_text":"صورة"},"search":{"sort_by":"رتب حسب","relevance":"الملاءمة","latest_post":"آخر المنشورات","latest_topic":"آخر الموضوعات","most_viewed":"الأكثر مشاهدة","most_liked":"الأكثر إعجابا","select_all":"أختر الكل","clear_all":"إلغ إختيار الكل","too_short":"عبارة البحث قصيرة جدًّا.","title":"أبحث في الموضوعات أو المنشورات أو الأعضاء أو الأقسام","no_results":"لا يوجد نتائج.","no_more_results":"لا يوجد نتائج أخرى.","searching":"يبحث...","post_format":"#{{post_number}} كتبها {{username}}","more_results":"يوجد عدد كبير من النتائج, يرجى تضييق نطاق البحث.","cant_find":"لا تستطيع ايجاد ما تبحث عنة؟","start_new_topic":"افتح موضوع جديد.","or_search_google":"او حاول البحث باستخدام google:","search_google":"حاول البحث باستخدام google:","search_google_button":"جوجل","search_google_title":"ابحث في هذا الموقع","context":{"user":"ابحث في منشورات @{{username}}","category":"أبحث في قسم #{{category}}","topic":"ابحث في هذا الموضوع","private_messages":"البحث في الرسائل الخاصة"},"advanced":{"title":"بحث متقدّم","posted_by":{"label":"نشرها"},"in_group":{"label":"في المجموعة"},"with_badge":{"label":"عليها شارة"},"with_tags":{"label":"موسوم"},"filters":{"likes":"أعجبتني","posted":"نشرت بها","watching":"أراقبها","tracking":"أتابعها","bookmarks":"وضعت علية علامة مرجعية","first":"اول منشور في الموضوعات","pinned":"مثبتة","unpinned":"غير مثبتة","seen":"قراءته","unseen":"لم أقرأها","wiki":"من النوع wiki"},"statuses":{"label":"بشرط أن تكون المواضيع","open":"مفتوحة","closed":"مغلقة","archived":"مؤرشفة","noreplies":"ليس فيها أيّ ردّ","single_user":"تحتوي عضوا واحدا"},"post":{"count":{"label":"أدنى عدد للمنشورات"},"time":{"label":"المُرسَلة","before":"قبل","after":"بعد"}}}},"hamburger_menu":"إنتقل إلى قائمة موضوعات أو قسم أخر.","new_item":"جديد","go_back":"الرجوع","not_logged_in_user":"صفحة المستخدم مع ملخص عن نشاطه و إعداداته","current_user":"الذهاب إلى صفحتك الشخصية","topics":{"new_messages_marker":"آخر مشاهدة","bulk":{"select_all":"حدّد الكلّ","clear_all":"مسح الكل","unlist_topics":"ازل الموضوعات من القائمة","relist_topics":"ادرج الموضوعات بالقائمة","reset_read":"عين كغير مقروءة","delete":"أحذف الموضوعات","dismiss":"تجاهل","dismiss_read":"تجاهل المنشورات غير المقروءة","dismiss_button":"تجاهل...","dismiss_tooltip":"تجاهل فقط المنشورات الجديدة او توقف عن تتبع الموضوعات","also_dismiss_topics":"التوقف عن متابعه الموضوعات حتي لا تظهر كغير مقروءة مره اخرى ","dismiss_new":"تجاهل الجديد","toggle":"إيقاف/تشغيل التحديد الكمي للموضوعات","actions":"عمليات تنفذ دفعة واحدة","change_category":"حدد القسم","close_topics":"إغلاق الموضوعات","archive_topics":"أرشفة الموضوعات","notification_level":"الاشعارات","choose_new_category":"اختر القسم الجديد للموضوعات:","selected":{"zero":"لم تحدد شيئا.","one":"حددت موضوع \u003cb\u003eواحد\u003c/b\u003e.","two":"حددت \u003cb\u003eموضوعين\u003c/b\u003e.","few":"حددت \u003cb\u003e{{count}}\u003c/b\u003e مواضيع.","many":"حددت \u003cb\u003e{{count}}\u003c/b\u003e موضوعا.","other":"حددت \u003cb\u003e{{count}}\u003c/b\u003e موضوع."},"change_tags":"غيّر الأوسمة","append_tags":"اضف الأوسمة","choose_new_tags":"اختر أوسمة جديدة لهذه الموضوعات:","choose_append_tags":"اختر أوسمة جديدة لإضافتها لهذة الموضوعات","changed_tags":"تغيرت أوسمة هذه الموضوعات."},"none":{"unread":"ليست هناك مواضيع غير مقروءة.","new":"ليست هناك مواضيع جديدة.","read":"لم تقرأ أيّ موضوع بعد.","posted":"لم تشارك في أيّ موضوع بعد.","latest":"لا مواضيع حديثة. يا للأسف.","bookmarks":"لا مواضيع معلّمة بعد.","category":"لا يوجد موضوعات في قسم ’{{category}}‘.","top":"لا يوجد موضوعات مشاهدة بكثرة","educate":{"new":"\u003cp\u003eسوف تظهر موضوعاتك هنا.\u003c/p\u003e\u003cp\u003eبشكل افتراضي تعتبر الموضوعات جديدة و يظهر بجانبها كلمه \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003eجديد\u003c/span\u003e إذا لم يمضي علي نشرها اكثر من يومين.\u003c/p\u003e\u003cp\u003eزور صفحة \u003ca href=\"%{userPrefsUrl}\"\u003eالتفضيلات\u003c/a\u003e لتغيير هذا السلوك\u003c/p\u003e","unread":"\u003cp\u003eالموضوعات الغير مقروءة تظهر هنا.\u003c/p\u003e\u003cp\u003eبشكل افتراضي تعتبر الموضوعات غير مقروءة و يظهر بجانبها عداد \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e في حال:\u003c/p\u003e\u003cul\u003e\u003cli\u003eانشأت الموضوع\u003c/li\u003e\u003cli\u003eرددت علي الموضوع\u003c/li\u003e\u003cli\u003eقرأت الموضوع لاكثر من اربع دقائق\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eاو قمت بضبط مستوي اشعارات الموضوع إلي مراقب او متابع.\u003c/p\u003e\u003cp\u003eزور صفحة \u003ca href=\"%{userPrefsUrl}\"\u003eالتفضيلات\u003c/a\u003e لتغيير هذا السلوك.\u003c/p\u003e"}},"bottom":{"latest":"لا يوجد موضوعات حديثة أخرى.","posted":"لا يوجد مواضيع منشورة أخرى.","read":"لا يوجد موضوعات مقروءة أخرى.","new":"لا يوجد مواضيع جديدة أخرى.","unread":"لا يوجد موضوعات غير مقروءة أخرى.","category":"لا يوجد مواضيع أخرى في قسم \"{{category}}\".","top":"لا يوجد موضوعات مشاهدة بكثرة اخري.","bookmarks":"لا يوجد موضوعات عليها علامة مرجعية اخري."}},"topic":{"filter_to":{"zero":"لا يوجد منشورات في الموضوع","one":"منشور واحد في الموضوع","two":"منشورين في الموضوع","few":"{{count}} منشور في الموضوع","many":"{{count}} منشور في الموضوع","other":"{{count}} منشور في الموضوع"},"create":"موضوع جديد","create_long":"كتابة موضوع جديد","private_message":"أرسل رسالة خاصة","archive_message":{"help":"انقل الرسالة للأرشيف لديك","title":"إلى الأرشيف"},"move_to_inbox":{"title":"انقل إلى البريد الوارد","help":"انقل الرسالة للبريد الوارد"},"edit_message":{"title":"تحرير رسالة"},"defer":{"title":"تأجيل"},"list":"الموضوعات","new":"موضوع جديد","unread":"غير مقروء","new_topics":{"zero":"لا مواضيع جديدة","one":"موضوع واحد جديد","two":"موضوعان جديدان","few":"{{count}} مواضيع جديدة","many":"{{count}} موضوعًا جديدًا","other":"{{count}} موضوع جديد"},"unread_topics":{"zero":"لا مواضيع غير مقروءة","one":"موضوع واحد غير مقروء","two":"موضوعان غير مقروءان","few":"{{count}} مواضيع غير مقروءة","many":"{{count}} موضوعًا غير مقروء","other":"{{count}} موضوع غير مقروء"},"title":"الموضوع","invalid_access":{"title":"الموضوع خاص","description":"عذرا, لا تملك صلاحيات الوصول لهذا الموضوع","login_required":"عليك تسجيل الدخول لرؤية هذا الموضوع."},"server_error":{"title":"فشل تحميل الموضوع","description":"عذرا، تعذر علينا تحميل هذا الموضوع، قد يرجع ذلك إلى مشكلة بالاتصال. من فضلك حاول مجددا. أخبرنا بالمشكلة إن استمر حدوثها."},"not_found":{"title":"لم يُعثر على الموضوع","description":"عذرا، لم نجد هذا الموضوع. ربما أزاله أحد المشرفين؟"},"total_unread_posts":{"zero":"لا يوجد منشورات غير مقروء في هذا الموضوع","one":"لديك منشور واحد غير مقروء في هذا الموضوع","two":"لديك {{count}} منشور غير مقروء في هذا الموضوع","few":"لديك {{count}} منشور غير مقروء في هذا الموضوع","many":"لديك {{count}} منشور غير مقروء في هذا الموضوع","other":"لديك {{count}} منشور غير مقروء في هذا الموضوع"},"unread_posts":{"zero":"لا مشاركات قديمة غير مقروءة في هذا الموضوع","one":"لديك مشاركة واحدة قديمة غير مقروءة في هذا الموضوع","two":"لديك مشاركتين قديمتين غير مقروءتين في هذا الموضوع","few":"لديك {{count}} مشاركات قديمة غير مقروءة في هذا الموضوع","many":"لديك {{count}} مشاركة قديمة غير مقروءة في هذا الموضوع","other":"لديك {{count}} مشاركة قديمة غير مقروءة في هذا الموضوع"},"new_posts":{"zero":"لا يوجد منشورات جديد في هذا الموضوع منذ اخر مرة قرأته","one":"هناك منشور واحد جديد في هذا الموضوع منذ اخر مرة قرأته","two":"هناك منشورين جديدين في هذا الموضوع منذ اخر مرة قرأته","few":"هناك {{count}} منشور جديد في هذا الموضوع منذ اخر مرة قرأته","many":"هناك {{count}} منشور جديد في هذا الموضوع منذ اخر مرة قرأته","other":"هناك {{count}} منشور جديد في هذا الموضوع منذ اخر مرة قرأته"},"likes":{"zero":"لا إعجابات في هذا الموضوع","one":"هناك إعجاب واحد في هذا الموضوع","two":"هناك إعجابين في هذا الموضوع","few":"هناك {{count}} إعجابات في هذا الموضوع","many":"هناك {{count}} إعجابا في هذا الموضوع","other":"هناك {{count}} إعجاب في هذا الموضوع"},"back_to_list":"عد إلى قائمة الموضوعات","options":"خيارات الموضوعات","show_links":"اظهر الروابط في هذا الموضوع","toggle_information":"أظهر/أخف تفاصيل الموضوع","read_more_in_category":"أتريد قراءة المزيد؟ تصفح المواضيع الأخرى في {{catLink}} أو {{latestLink}}.","read_more":"أتريد قراءة المزيد؟ {{catLink}} أو {{latestLink}}.","browse_all_categories":"تصفّح كل الأقسام","view_latest_topics":"اعرض اخر الموضوعات","suggest_create_topic":"لمَ لا تكتب موضوعًا؟","jump_reply_up":"انتقل إلى أول رد","jump_reply_down":"انتقل إلى آخر رد","deleted":"الموضوع محذوف","topic_status_update":{"save":"ضع مؤقت","num_of_hours":"عدد الساعات:","remove":"ازل المؤقت","publish_to":"انشر في:","when":"متى:"},"auto_update_input":{"later_today":"في وقت لاحق اليوم","tomorrow":"غداً","later_this_week":"في وقت لاحق هذا الاسبوع","this_weekend":"هذا الأسبوع","next_week":"الاسبوع القادم","next_month":"الشهر القادم","one_year":"سنة واحدة","forever":"للأبد","pick_date_and_time":"اختر التاريخ والوقت","set_based_on_last_post":"اغلقة بناء علي اخر منشور"},"publish_to_category":{"title":"جدولة النشر"},"temp_open":{"title":"افتح الموضوع مؤقتا"},"auto_reopen":{"title":"افتح الموضوع بشكل تلقائي"},"temp_close":{"title":"اغلق الموضوع مؤقتا"},"auto_close":{"title":"اغلق الموضوع بشكل تلقائي","label":"اغلق الموضوع بشكل تلقائي بعد:","error":"من فضلك ادخل قيمة صالحة.","based_on_last_post":"لا تقم بغلق الموضوع حتي يصبح اخر منشور بهذا القدم"},"auto_delete":{"title":"احذف الموضوع بشكل تلقائي"},"reminder":{"title":"ذكرني"},"status_update_notice":{"auto_open":"سيُفتح هذا الموضوع آليًّا %{timeLeft}.","auto_close":"سيُغلق هذا الموضوع آليًّا %{timeLeft}.","auto_publish_to_category":"سيُنشر هذا الموضوع في\u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e %{timeLeft}.","auto_close_based_on_last_post":"سيُغلق هذا الموضوع %{duration} بعد آخر ردّ فيه.","auto_delete":"هذا الموضوع سوف يحذف تلقائيا %{timeLeft}.","auto_reminder":"سوف يتم تذكيرك بهذا الموضوع %{timeLeft}."},"auto_close_title":"إعدادات الإغلاق الآلي","auto_close_immediate":{"zero":"اخر منشور بهذا الموضوع نشر بالفعل منذ اقل من ساعة, لذا سيتم غلق الموضوع الأن.","one":"اخر منشور بهذا الموضوع نشر بالفعل منذ ساعة واحدة, لذا سيتم غلق الموضوع الأن.","two":"اخر منشور بهذا الموضوع نشر بالفعل منذ ساعتين, لذا سيتم غلق الموضوع الأن.","few":"اخر منشور بهذا الموضوع نشر بالفعل منذ %{count} ساعة, لذا سيتم غلق الموضوع الأن.","many":"اخر منشور بهذا الموضوع نشر بالفعل منذ %{count} ساعة, لذا سيتم غلق الموضوع الأن.","other":"اخر منشور بهذا الموضوع نشر بالفعل منذ %{count} ساعة, لذا سيتم غلق الموضوع الأن."},"timeline":{"back":"الرجوع","back_description":"عد إلى آخر منشور غير مقروء","replies_short":"%{current} / %{total}"},"progress":{"title":"حالة الموضوع","go_top":"أعلى","go_bottom":"أسفل","go":"اذهب","jump_bottom":"انتقل لآخر منشور","jump_prompt":"انتقل إلى...","jump_prompt_of":"من %{count} منشورات","jump_bottom_with_number":"انتقل إلى المنشور %{post_number}","jump_prompt_or":"أو","total":"مجموع المنشورات","current":"المنشورات الحالية"},"notifications":{"title":"غير معدل الاشعارات التي تصلك من هذا الموضوع","reasons":{"mailing_list_mode":"وضع القائمة البريدية لديك مفعّل، لذلك ستصلك إشعارات بالردود على هذا الموضوع عبر البريد الإلكتروني.","3_10":"ستصلك إشعارات لأنك تراقب وسما يحملة هذا الموضوع.","3_6":"ستصلك إشعارات لأنك تراقب هذا القسم.","3_5":"ستصلك إشعارات لأنك تحولت لمراقبة هذا الموضوع آليا.","3_2":"ستصلك إشعارات لأنك تراقب هذا الموضوع.","3_1":"ستصلك إشعارات لأنك أنشأت هذا الموضوع.","3":"ستصلك إشعارات لأنك تراقب هذا الموضوع.","2_8":"سوف تشاهد عداد للردود الجديدة لانك تتابع هذا القسم.","2_4":"سوف تشاهد عداد للردود الجديدة لانك قمت بالمشاركة برد في هذا الموضوع.","2_2":"سوف تشاهد عداد للردود الجديدة لانك تتابع هذا الموضوع.","2":"سوف تشاهد عداد للردود الجديدة لأنّك \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003eقرأت هذا الموضوع\u003c/a\u003e.","1_2":"سيصلك إشعار إن أشار أحد إلى @اسمك أو رد عليك.","1":"سيصلك إشعار إن أشار أحد إلى @اسمك أو رد عليك.","0_7":"لن يصلك أي إشعار يخص هذا القسم.","0_2":"لن يصلك أي إشعار يخص هذا الموضوع بناء على طلبك.","0":"لن يصلك أي إشعار يخص هذا الموضوع بناء على طلبك."},"watching_pm":{"title":"مُراقب","description":"سيصلك إشعار لكل رد جديد علي هذه الرسالة، وسيظهر عداد للردود الجديدة."},"watching":{"title":"مراقَب","description":"سيصلك إشعار لكل رد جديد علي هذا الموضوع، وسيظهر عداد اللردود الجديدة."},"tracking_pm":{"title":"مُتابع","description":"سيظهر عداد للردود الجديدة علي هذه الرسالة. سيصلك إشعار إن أشار أحد إلى @اسمك أو رد عليك."},"tracking":{"title":"متابَع","description":"سيظهر عداد للردود الجديدة علي هذه الرسالة. سيصلك إشعار إن أشار أحد إلى @اسمك أو رد عليك."},"regular":{"title":"عادي","description":"سيصلك إشعارا إن أشار أحد إلى @اسمك أو رد عليك."},"regular_pm":{"title":"عادي","description":"سيصلك إشعارا إن أشار أحد إلى @اسمك أو رد عليك."},"muted_pm":{"title":"مكتوم","description":"لن تصلك أية إشعارات علي هذه الرسالة."},"muted":{"title":"مكتوم","description":"لن تصلك أية إشعارات عن هذا الموضوع، ولن يظهر في اخر الموضوعات."}},"actions":{"title":"الإجراءات","recover":"إلغاء حذف الموضوع","delete":"احذف الموضوع","open":"افتح الموضوع","close":"أغلق الموضوع","multi_select":"حدد المنشورات...","timed_update":"ضع مؤقت للموضوع...","pin":"ثبّت الموضوع...","unpin":"ألغِ تثبيت الموضوع","unarchive":"أخرج الموضوع من الأرشيف","archive":"أرشف الموضوع","invisible":"إزل من القائمة","visible":"إضاف إلي القائمة","reset_read":"تصفير بيانات القراءة","make_public":"اجعل الموضوع للعموم"},"feature":{"pin":"تثبيت الموضوع","unpin":"إلغاء تثبيت الموضوع","pin_globally":"تثبيت الموضوع على عموم الموقع","make_banner":"اجعلة إعلان","remove_banner":"ازل الإعلان"},"reply":{"title":"رُدّ","help":"اكتب ردًّا على هذه الموضوع"},"clear_pin":{"title":"إلغاء التثبيت","help":"إلغاء تثبيت الموضوع حتى لا يظهر في أعلى القائمة"},"share":{"title":"مشاركة","help":"شارك رابط هذا الموضوع"},"print":{"title":"اطبع","help":"افتح نسخة متوافقة مع الطابعة من هذا الموضوع"},"flag_topic":{"title":"أبلغ","help":"بلَغ عن هذا الموضوع او ارسل تنبيه خاص لأدارة الموقع.","success_message":"لقد أبلغت عن هذا الموضوع بنجاح."},"feature_topic":{"title":"مميز هذا الموضوع","pin":"اجعل هذا الموضوع يظهر أعلى قسم {{categoryLink}} حتى","confirm_pin":"لديك مسبقاً {{count}} موضوع مثبت. قد تكون كثرة المواضيع المثبتة عبئاً على الأعضاء الجدد والزوار. هل أنت متأكد أنك تريد تثبيت موضوع آخر في هذا القسم؟","unpin":"أزل هذا الموضوع من أعلى قسم \"{{categoryLink}}\".","unpin_until":"أزل هذا الموضوع من أعلى قسم \"{{categoryLink}}\" أو انتظر حتى \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"الاعضاء يستطعون إزالة تثبيت الموضوع لأنفسهم.","pin_validation":"التاريخ مطلوب لتثبيت هذا الموضوع.","not_pinned":"لا يوجد موضوعات مثبتة في {{categoryLink}}.","already_pinned":{"zero":"المواضيع مثبتة حالياً في {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","one":"المواضيع مثبتة حالياً في {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","two":"المواضيع مثبتة حالياً في {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","few":"المواضيع مثبتة حالياً في {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","many":"المواضيع مثبتة حالياً في {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"الموضوعات مثبتة حالياً في {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"اعرض هذا الموضوع أعلى كل قوائم الموضوعات حتى","confirm_pin_globally":"لديك {{count}} موضوع مثبت علي عموم الموقع مما قد يشكل عبئ على الأعضاء الجدد و الزوار. هل أنت واثق أنك تريد تثبيت موضوع أخر على عموم الموقع؟","unpin_globally":"أزل هذا الموضوع من أعلى كل قوائم الموضوعات.","unpin_globally_until":"أزل هذا الموضوع من أعلى قوائم الموضوعات أو انتظر حتى \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"يمكن للاعضاء إذالة تثبيت الموضوع لأنفسهم. ","not_pinned_globally":"لا يوجد موضوعات مثبتة للعموم.","already_pinned_globally":{"zero":"الموضوعات المثبتة علي عموم الموقع حاليا: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","one":"الموضوعات المثبتة علي عموم الموقع حاليا: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","two":"الموضوعات المثبتة علي عموم الموقع حاليا: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","few":"الموضوعات المثبتة علي عموم الموقع حاليا: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","many":"الموضوعات المثبتة علي عموم الموقع حاليا: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"الموضوعات المثبتة علي عموم الموقع حاليا: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"اجعل هذا الموضوع إعلانا يظهر أعلى كل الصفحات.","remove_banner":"أزل الإعلان الذي يظهر أعلى كل الصفحات.","banner_note":"الأعضاء يستطيعون تجاهل الموضوع المثبت كإعلان بإغلاقه. لا تمكن تعيين اكثر من موضوع في نفس الوقت كإعلان.","no_banner_exists":"لا يوجد اعلانات","banner_exists":"\u003cstrong class='badge badge-notification unread'\u003eيوجد\u003c/strong\u003e حاليا إعلان"},"inviting":"دعوة...","automatically_add_to_groups":"هذه الدعوة تشتمل ايضا الوصول الى هذه المجموعات:","invite_private":{"title":"رسالة دعوة","email_or_username":"دعوات عن طريق البريد الإلكتروني او اسم المستخدم","email_or_username_placeholder":"البريد الإلكتروني أو إسم المستخدم","action":"دعوة","success":"لقد دعونا ذلك العضو للمشاركة في هذه الرسالة.","success_group":"لقد دعونا تلك المجموعة للمشاركة في هذه الرسالة.","error":"عذرا، حدث عطل أثناء دعوة هذا المستخدم.","group_name":"اسم المجموعة"},"controls":"لوحة تحكم الموضوع","invite_reply":{"title":"دعوة","username_placeholder":"اسم المستخدم","action":"أرسل دعوة","help":"دعوة الآخرين إلى هذا الموضوع عبر البريد الإلكتروني أو الإشعارات","to_forum":"سنُرسل بريد إلكترني يتيح لصديقك الانضمام مباشرةً بنقر رابط فيه، تسجيل الدخول غير مطلوب.","sso_enabled":"أدخل اسم مَن تريد دعوته إلى هذا الموضوع.","to_topic_blank":"أدخل اسم او عنوان بريد الشخص الذي تريد دعوته إلى هذا الموضوع.","to_topic_email":"لقد أدخلت عنوان بريد إلكترونيّ. سنرسل بريدً إلكترونياً يحتوي دعوة تتيح لصديقك الرّد مباشرة على هذا الموضوع.","to_topic_username":"لقد أدخلت اسم مستخدم. سنرسل إشعارًا يحتوي رابطًا يدعوهم إلى هذا الموضوع.","to_username":"أدخل اسم المستخدم للشخص الذي تريد دعوته. سنرسل إشعارًا يحتوي رابطًا يدعوهم إلى هذا الموضوع.","email_placeholder":"name@example.com","success_email":"قمنا بإرسال دعوة بالبريد لـ \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e . سيتم تنبيهك عند قبول الدعوة , تحقق من تبويب الدعوات في صفحتك الشخصية لمتابعة دعوتك.","success_username":"دعونا هذا العضو للمشاركة في هذا الموضوع.","error":"عذرا, لا يمكنك دعوة هذا الشخص, ربما لأن تم دعوتة مسبقا؟ (الدعوات محدودة)","success_existing_email":"العضو ذو عنوان البريد الإلكتروني \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e مسجل بالفعل. لقد قمنا بدعوتة للمشاركة بهذا الموضوع."},"login_reply":"عليك تسجيل الدخول للرد","filters":{"n_posts":{"zero":"لا يوجد منشورات","one":"منشور واحد","two":"منشوران","few":"{{count}} منشور","many":"{{count}} منشور","other":"{{count}} منشور"},"cancel":"إزالة الترشيح"},"split_topic":{"title":"نقل الى موضوع جديد","action":"نقل الى موضوع جديد","radio_label":"موضوع جديد","error":"حدث عطل أثناء نقل المنشورات إلى موضوع جديد.","instructions":{"zero":"أنت على وشك انشاء موضوع جديد, ولم تقم باختيار أي منشور لتعبئته.","one":"أنت على وشك انشاء موضوع جديد وتعبئته بمنشورم اخترتة.","two":"أنت على وشك انشاء موضوع جديد وتعبئته منشورين اخترتهما.","few":"أنت على وشك انشاء موضوع جديد وتعبئته بـ \u003cb\u003e{{count}}\u003c/b\u003e منشور اخترتة.","many":"أنت على وشك انشاء موضوع جديد وتعبئته بـ \u003cb\u003e{{count}}\u003c/b\u003e منشور اخترتة.","other":"أنت على وشك انشاء موضوع جديد وتعبئته بـ \u003cb\u003e{{count}}\u003c/b\u003e منشور اخترتة."}},"merge_topic":{"title":"نقل الى موضوع موجود","action":"نقل الى موضوع موجود","error":"حدث عطل أثناء نقل المنشورات إلى الموضوع ذاك.","instructions":{"zero":"لم يتم اختيار أي منشورات لنقلها !","one":"الرجاء اختيار الموضوع الذي تود نقل منشور واحد إليه.","two":"الرجاء اختيار الموضوع الذي تود نقل منشورين إليه.","few":"الرجاء اختيار الموضوع الذي تود نقل الـ\u003cb\u003e{{count}}\u003c/b\u003e منشور إليه.","many":"الرجاء اختيار الموضوع الذي تود نقل الـ\u003cb\u003e{{count}}\u003c/b\u003e منشور إليه.","other":"الرجاء اختيار الموضوع الذي تود نقل الـ\u003cb\u003e{{count}}\u003c/b\u003e منشور إليه."}},"move_to_new_message":{"radio_label":"رسالة جديدة"},"merge_posts":{"title":"ادمج المنشورات المحدّدة","action":"ادمج المنشورات المحددة","error":"حدث عطل أثناء دمج المنشورات المحدّدة."},"change_owner":{"action":"تغيير الكاتب","error":"حدث عطل أثناء تغيير كاتب هذة المنشورات.","placeholder":"اسم مستخدم الكاتب الجديد"},"change_timestamp":{"title":"غير تاريخ النشر...","action":"غير تاريخ النشر...","invalid_timestamp":"لا يمكن أن يكون تاريخ النشر في المستقبل.","error":"حدث عطل أثناء تغيير تاريخ النشر.","instructions":"من فضلك اختر تاريخ النشر الجديد للموضوع. سيتم تحديث تاريخ نشر منشورات الموضوع حتي يتم الحفاظ علي نفس الفارق الزمني."},"multi_select":{"select":"حدد","selected":"محددة ({{count}})","select_post":{"label":"إختيار"},"selected_post":{"label":"تم الإختيار"},"select_replies":{"label":"حددها مع الردود عليها"},"delete":"احذف المحدد","cancel":"ألغِ التحديد","select_all":"حدد الكل","deselect_all":"أزل تحديد الكل","description":{"zero":"لم تحدّد أي منشورات.","one":"لقد حدّدت منشور\u003cb\u003eواحد\u003c/b\u003e.","two":"لقد حدّدت \u003cb\u003eمنشورين\u003c/b\u003e.","few":"لقد حدّدت \u003cb\u003e{{count}}\u003c/b\u003e منشور.","many":"لقد حدّدت \u003cb\u003e{{count}}\u003c/b\u003e منشور.","other":"لقد حدّدت \u003cb\u003e{{count}}\u003c/b\u003e منشور."}}},"post":{"quote_reply":"اقتبس","edit_reason":"السبب:","post_number":"المنشور {{number}}","wiki_last_edited_on":"آخر تعديل على الـ wiki في ","last_edited_on":"آخر تعديل على المنشور في ","reply_as_new_topic":"التعليق على الموضوع الاصلي","reply_as_new_private_message":"الرد في رسالة جديدة علي نفس المستلم","continue_discussion":"تكملة النقاش من {{postLink}}:","follow_quote":"انتقل إلى المنشور المقتبَس منه","show_full":"عرض كامل المنشور","deleted_by_author":{"zero":"(سحب الكاتب المنشور، سيحذف آليًّا الأن ما لم يُبلّغ عنه)","one":"(سحب الكاتب المنشور، سيحذف آليًّا خلال ساعة واحدة ما لم يُبلّغ عنه)","two":"(سحب الكاتب المنشور، سيحذف آليًّا خلال %{count} ساعة ما لم يُبلّغ عنه)","few":"(سحب الكاتب المنشور، سيحذف آليًّا خلال %{count} ساعة ما لم يُبلّغ عنه)","many":"(سحب الكاتب المنشور، سيحذف آليًّا خلال %{count} ساعة ما لم يُبلّغ عنه)","other":"(سحب الكاتب المنشور، سيحذف آليًّا خلال %{count} ساعة ما لم يُبلّغ عنه)"},"expand_collapse":"إظهار/إخفاء","gap":{"zero":"لا يوجد ردود مخفية","one":"اعرض رد واحد مخفي","two":"اعرض ال‍ {{count}} رد مخفي","few":"اعرض ال‍ {{count}} رد مخفي","many":"اعرض ال‍ {{count}} رد مخفي","other":"اعرض ال‍ {{count}} رد مخفي"},"unread":"المنشور غير مقروء","has_replies":{"zero":"لا ردود","one":"رد واحد","two":"{{count}} رد","few":"{{count}} رد","many":"{{count}} رد","other":"{{count}} رد"},"has_likes_title":{"zero":"{{count}} عضو اعجب بهذا المشروع","one":"عضو واحد اعجب بهذا المشروع","two":"{{count}} عضو اعجب بهذا المشروع","few":"{{count}} عضو اعجب بهذا المشروع","many":"{{count}} عضو اعجب بهذا المشروع","other":"{{count}} عضو اعجب بهذا المشروع"},"has_likes_title_only_you":"اعجبك هذا المنشور","has_likes_title_you":{"zero":"لم يعجب احد غيرك بهذا المنشور","one":"انت و عضو واحد غيرك اعجبكم هذا المنشور.","two":"انت و عضوين غيرك اعجبكم هذا المنشور.","few":"انت و {{count}} غيرك اعجبكم هذا المنشور.","many":"انت و {{count}} غيرك اعجبكم هذا المنشور.","other":"انت و {{count}} غيرك اعجبكم هذا المنشور."},"errors":{"create":"عذرا، حدثت مشكلة اثناء إنشاء منشورك. من فضلك حاول مجددا.","edit":"عذرا، حدثت مشكلة اثناء تعديل منشورك. من فضلك حاول مجددا.","upload":"عذرا، حدثت مشكلة اثناء رفع الملف. من فضلك حاول مجددا.","too_many_uploads":"عذرا، يمكنك فقط رفع ملف واحد كل مرة.","upload_not_authorized":"عذرا, نوع الملف الذي تحاول رفعة محذور ( الانواع المسموح بها: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"عذرا، لا يمكن للأعضاء الجدد رفع الصور.","attachment_upload_not_allowed_for_new_user":"عذرا، لا يمكن للأعضاء الجدد رفع المرفقات.","attachment_download_requires_login":"عذرا، عليك تسجيل الدخول لتحميل المرفقات."},"abandon_edit":{"no_value":"لا, إبقاء"},"abandon":{"confirm":"أمتأكد من التخلي عن المنشور؟","no_value":"لا، أبقه","yes_value":"نعم، لا أريده"},"via_email":"وصل هذا المنشور عبر البريد","via_auto_generated_email":"وصل هذا المنشور عبر بريد مولّد آلياً","whisper":"هذا المنشور سري خاص بالمشرفين","wiki":{"about":"هذا المنشور نوعة wiki"},"archetypes":{"save":"احفظ الخيارات"},"few_likes_left":"نشكرك على نشر المحبة في المجتمع! و لكن للأسف لقد اقتربت من حد الاعجابات اليومي المسموح بة.","controls":{"reply":"ابدا في كتابة رد علي هذا المنشور","like":"اعجبني هذا المنشور","has_liked":"اعجبت بهذا المنشور","undo_like":"إلغاء الإعجاب","edit":"عدّل المنشور","edit_action":"عدّل","edit_anonymous":"عذرا، عليك تسجيل الدخول لتعديل المنشور.","flag":"ابلَغ عن هذا الموضوع او ارسل تنبيه خاص لأدارة الموقع.","delete":"احذف المنشور","undelete":"تراجع عن حذف المنشور","share":"شارك رابط هذا المنشور","more":"المزيد","delete_replies":{"just_the_post":"لا، المشاركة فحسب"},"admin":"صلاحيات المدير","wiki":"اجعل المنشور wiki","unwiki":"اجعل المنشور عادي","convert_to_moderator":"اجعل لون المنشور مميز","revert_to_regular":"اجعل لون المنشور عادي","rebake":"أعد بناء HTML","unhide":"إظهار","change_owner":"غير الكاتب","grant_badge":"منح شارة","delete_topic":"احذف الموضوع"},"actions":{"flag":"ابلاغ","undo":{"off_topic":"تراجع عن التبليغ","spam":"تراجع عن البلاغ","inappropriate":"تراجع عن البلاغ","bookmark":"تراجع عن البلاغ","like":"تراجع عن الإعجاب"},"people":{"off_topic":"ابلغ عنه انه خارج الموضوع","spam":"ابلغ عنه انه سبام","inappropriate":"ابلغ عنه انه غير لائق","notify_moderators":"تم تنبية المشرفين","notify_user":"ارسلت رساله","bookmark":"وضع علية علامة مرجعية"},"by_you":{"off_topic":"لقد ابلغت ان هذا المنشور خارج الموضوع","spam":"لقد ابلغت ان هذا المنشور سبام","inappropriate":"لقد ابلغت ان هذا المنشور غير لائق","notify_moderators":"لقد ابلغت المشرفين عن هذا المنشور","notify_user":"لقد أرسلت رسالة إلى هذا العضو","bookmark":"لقد وضعت علامة مرجعية علي هذا المنشور","like":"أعجبت بهذا المنشور"}},"merge":{"confirm":{"zero":"لا يوجد منشورات لدمجها","one":"هل انت متاكد انك تريد دمج هذا المنشور؟","two":"هل انت متاكد انك تريد دمج هذان المنشوران؟","few":"هل انت متاكد انك تريد دمج الـ {{count}} منشور؟","many":"هل انت متاكد انك تريد دمج الـ {{count}} منشور؟","other":"هل انت متاكد انك تريد دمج الـ {{count}} منشور؟"}},"revisions":{"controls":{"first":"أول مراجعة","previous":"المراجعة السابقة","next":"المراجعة التالية","last":"آخر مراجعة","hide":"أخفِ المراجعة","show":"أظهر المراجعة","revert":"ارجع إلى هذه المراجعة","edit_wiki":"عدل الwiki","edit_post":"عدل المنشور"},"displays":{"inline":{"title":"اعرض النسخة المنسقة في عمود واحد مع تمييز الاسطر المضافة و المحذوفة","button":"عمود واحد"},"side_by_side":{"title":"اعرض الفروقات في النسخة المنسقة جنبا إلي جنب","button":"عمودين"},"side_by_side_markdown":{"title":"اعرض الفروقات في النسخة الخام جنبا إلي جنب","button":"عمودين خام"}}},"raw_email":{"displays":{"raw":{"title":"اعرض نص الرساله الخام","button":"خام"},"text_part":{"title":"اظهر الجزء النصي من رسالة البريد الالكتروني","button":"نص"},"html_part":{"title":"اظهر جزء الـ HTML من رسالة البريد الالكتروني","button":"HTML"}}},"bookmarks":{"created":"أُنشئ في","name":"الإسم"}},"category":{"can":"قادر علي\u0026hellip;","none":"(غير مصنف)","all":"كل الأقسام","edit":"عدّل","view":"أظهار المواضيع في القسم","general":"عام","settings":"اعدادات","topic_template":"إطار الموضوع","tags":"الأوسمة","tags_placeholder":"(اختياري) قائمة الأوسمة المسموح بها","tag_groups_placeholder":"(اختياريّ) قائمة مجموعات الأوسمة المسموح بها","topic_featured_link_allowed":"اسمح بالروابط المُميزة بهذا القسم.","delete":"احذف التصنيف","create":"تصنيف جديد","create_long":"أنشئ تصنيف جديد","save":"احفظ القسم","slug":"عنوان القسم في الURL","slug_placeholder":"(اختياريّ) كلمات مفصولة-بشرطة للعنوان","creation_error":"حدثت مشكلة أثناء إنشاء القسم.","save_error":"حدث خطأ في حفظ القسم.","name":"اسم القسم","description":"الوصف","topic":"موضوع القسم","logo":"صورة القسم","background_image":"خلفية القسم","badge_colors":"ألوان الشارات","background_color":"لون الخلفية","foreground_color":"لون المقدمة","name_placeholder":"كلمة أو كلمتين على الأكثر","color_placeholder":"أيّ لون متوافق مع الانترنت","delete_confirm":"هل تريد فعلاً حذف هذا تصنيف؟","delete_error":"حدث خطأ أثناء حذف هذا التصنيف","list":"عرض الأقسام","no_description":"من فضلك أضف وصفا لهذا القسم.","change_in_category_topic":"عدّل الوصف","already_used":"هذا اللون تم استخدامه سابقا في قسم آخر","security":"الأمن","special_warning":"تحذير: هذا القسم هو قسم اصلي إعدادات الحماية له لا يمكن تعديلها. إذا لم تكن تريد استخدام هذا القسم، قم بحذفة بدلا من تطويعة لأغراض اخري.","images":"الصور","email_in":"تعيين بريد إلكتروني خاص:","email_in_allow_strangers":"قبول بريد إلكتروني من زوار لا يملكون حسابات","email_in_disabled":"عُطّل إرسال المشاركات عبر البريد الإلكترونيّ من إعدادات الموقع. لتفعيل نشر المشاركات الجديدة عبر البريد،","email_in_disabled_click":"قم بتفعيل خيار \"email in\" في الإعدادات","show_subcategory_list":"أظهر الأقسام الفرعية فوق الموضوعات من هذا القسم.","num_featured_topics":"عدد الموضوعات المعروضة في صفحة الأقسام:","subcategory_num_featured_topics":"عدد الموضوعات المُميزة في صفحة القسم الرئيسي.","subcategory_list_style":"أسلوب عرض قائمة الأقسام الفرعية:","sort_order":"رتب قائمة الموضوعات حسب:","default_view":"قائمة الموضوعات الإفتراضية","default_top_period":"فترة الاكثر مشاهدة الافتراضية","allow_badges_label":"السماح بالحصول على الأوسمة في هذا القسم","edit_permissions":"عدل التصاريح","review_group_name":"اسم المجموعة","this_year":"هذه السنة","default_position":"المكان الافتراضي","position_disabled":"سوف تُعرض الاقسام بترتيب نشاطها. للتّحكّم بترتيب الأقسام في القائمة،","position_disabled_click":"فعّل خاصية \"تثبيت ترتيب الأقسام\".","parent":"القسم الرئيسي","notifications":{"watching":{"title":"مُراقبة","description":"ستراقب آليا كل الموضوعات بهذا القسم. ستصلك إشعارات لكل منشور أو موضوع جديد، وسيظهر أيضا عدّاد الردود الجديدة."},"watching_first_post":{"title":"يُراقب فيها أول مشاركة"},"tracking":{"title":"مُتابعة","description":"ستتابع آليا كل موضوعات هذا القسم. ستصلك إشعارات إن أشار أحدهم إلى @اسمك أو رد عليك، وسيظهر عدّاد الردود الجديدة."},"regular":{"title":"منتظم","description":"ستستقبل إشعارًا إن أشار أحد إلى @اسمك أو ردّ عليك."},"muted":{"title":"مكتومة","description":"لن يتم إشعارك بأي موضوعات جديدة في هذه الأقسام ولن يتم عرضها في قائمة الموضوعات المنشورة مؤخراً."}},"search_priority":{"label":"أولوية البحث","options":{"normal":"عادي","ignore":"تجاهل"}},"sort_options":{"default":"افترضى","likes":"الاعجابات","op_likes":"الاعجابات علي المنشور الاساسي","views":"المشاهدات","posts":"المنشورات","activity":"النشاط","posters":"الإعلانات","category":"القسم","created":"تاريخ الإنشاء","votes":"أصوات"},"sort_ascending":"تصاعدي","sort_descending":"تنازلي","subcategory_list_styles":{"rows":"صفوف","rows_with_featured_topics":"صفوف مع الموضوعات المميزة","boxes":"مربعات","boxes_with_featured_topics":"مربعات مع الموضوعات المميزة"},"settings_sections":{"general":"عام","appearance":"الظهور","email":"البريد الإلكتروني"}},"flagging":{"title":"شكرا لمساعدتك في إبقاء مجتمعنا متحضرا.","action":"ابلغ عن المنشور","take_action":"اتخذ اجراء","notify_action":"رسالة","official_warning":"تحذير رسمي","delete_spammer":"احذف ناشر السبام","yes_delete_spammer":"نعم، احذف ناشر السبام","ip_address_missing":"(N/A)","hidden_email_address":"(مخفي)","submit_tooltip":"إرسال البلاغ","take_action_tooltip":"الوصول إلى الحد الأعلى للبلاغات دون انتظار بلاغات أكثر من أعضاء الموقع.","cant":"عذرا، لا يمكنك الابلاغ عن هذا المنشور في هذه اللحظة.","notify_staff":"ابلغ طاقم العمل بسرية","formatted_name":{"off_topic":"خارج عن الموضوع","inappropriate":"غير لائق","spam":"هذا سبام"},"custom_placeholder_notify_user":"كن محدد و كن بناء و دائما كن حسن الخلق","custom_placeholder_notify_moderators":"يمكنك تزودنا بمعلومات أكثر عن سبب عدم ارتياحك إلي هذا المنشور؟ زودنا ببعض الروابط و الأمثلة قدر الإمكان.","custom_message":{"at_least":{"zero":"لا تُدخل أيّ محرف","one":"أدخل حرف واحد على الأقل","two":"أدخل {{count}} احرف على الأقل","few":"أدخل {{count}} احرف على الأقل","many":"أدخل {{count}} احرف على الأقل","other":"أدخل {{count}} احرف على الأقل"},"more":{"zero":"{{count}} حرف متبقي علي الحد الادني...","one":"{{count}} حرف واحد متبقي علي الحد الادني...","two":"{{count}} حرف متبقي علي الحد الادني...","few":"{{count}} حرف متبقي علي الحد الادني...","many":"{{count}} حرف متبقي علي الحد الادني...","other":"{{count}} حرف متبقي علي الحد الادني..."},"left":{"zero":"{{count}} حرف متبقي علي الحد الاقصي...","one":"حرف واحد متبقي علي الحد الاقصي...","two":"{{count}} حرف متبقي علي الحد الاقصي...","few":"{{count}} حرف متبقي علي الحد الاقصي...","many":"{{count}} حرف متبقي علي الحد الاقصي...","other":"{{count}} حرف متبقي علي الحد الاقصي..."}}},"flagging_topic":{"title":"شكرا لمساعدتنا في ابقاء المجمتع متحضر","action":"التبليغ عن الموضوع","notify_action":"رسالة"},"topic_map":{"title":"ملخص الموضوع","participants_title":"الناشرون المترددون","links_title":"روابط مشهورة","links_shown":"أظهر روابط أخرى...","clicks":{"zero":"لا نقرات","one":"نقرة واحدة","two":"نقرتان","few":"%{count} نقرات","many":"%{count} نقرة","other":"%{count} نقرة"}},"post_links":{"about":"وسّع المزيد من الروابط في هذه المشاركة","title":{"zero":"لا شيء آخر","one":"واحدة أخرى","two":"إثنتان أخريتان","few":"%{count} أخرى","many":"%{count} أخرى","other":"%{count} أكثر"}},"topic_statuses":{"warning":{"help":"هذا تحذير رسمي."},"bookmarked":{"help":"لقد وضعت علامة مرجعية علي هذا الموضوع"},"locked":{"help":"هذا الموضوع مغلق, لذا فهو لم يعد يستقبل ردودا"},"archived":{"help":"هذا الموضوع مؤرشف، لذا فهو مجمد ولا يمكن تعديله"},"locked_and_archived":{"help":"هذا الموضوع مغلق ومؤرشف، لذا فهو لم يعد يستقبل ردودًا ولا يمكن تغييره"},"unpinned":{"title":"غير مثبّت","help":"هذا الموضوع غير مثبّت لك، وسيُعرض بالترتيب العادي"},"pinned_globally":{"title":"مثبّت للعموم","help":"هذا الموضوع مثبت بشكل عام, سوف يظهر في مقدمة قائمة اخر الموضوعات وفي القسم الخاصة به."},"pinned":{"title":"مثبّت","help":"هذا الموضوع مثبّت لك، وسيُعرض أعلى قسمة"},"unlisted":{"help":"هذا الموضوع غير مدرج, لن يظهر في قائمة الموضوعات ولا يمكن الوصول إلية إلا برابط مباشر"}},"posts":"منشورات","posts_long":"هناك {{number}} منشور في هذا الموضوع","original_post":"المنشور الاصلي","views":"المشاهدات","views_lowercase":{"zero":"المشاهدات","one":"المشاهدات","two":"المشاهدات","few":"المشاهدات","many":"المشاهدات","other":"المشاهدات"},"replies":"الردود","views_long":{"zero":"تم مشاهدة هذا الموضوع {{number}} مرة","one":"تم مشاهدة هذا الموضوع مرة واحدة","two":"تم مشاهدة هذا الموضوع {{number}} مرة","few":"تم مشاهدة هذا الموضوع {{number}} مرة","many":"تم مشاهدة هذا الموضوع {{number}} مرة","other":"تم مشاهدة هذا الموضوع {{number}} مرة"},"activity":"النشاط","likes":"اعجابات","likes_lowercase":{"zero":"اﻹعجابات","one":"اﻹعجابات","two":"اﻹعجابات","few":"اﻹعجابات","many":"اﻹعجابات","other":"اﻹعجابات"},"likes_long":"هناك {{number}} اعجابات في هذا الموضوع","users":"الأعضاء","users_lowercase":{"zero":"عضو","one":"عضو واحد","two":"عضوين","few":"الأعضاء","many":"الأعضاء","other":"الأعضاء"},"category_title":"قسم","history":"تاريخ","changed_by":"الكاتب {{author}}","raw_email":{"title":"البريد الإلكتروني الوارد","not_available":"غير متوفر!"},"categories_list":"قائمة الأقسام","filters":{"with_topics":"الموضوعات %{filter}","with_category":"الموضوعات%{filter} في %{category}","latest":{"title":"الأخيرة","title_with_count":{"zero":"الأخيرة ({{count}})","one":"الأخيرة ({{count}})","two":"الأخيرة ({{count}})","few":"الأخيرة ({{count}})","many":"الأخيرة ({{count}})","other":"الأخيرة ({{count}})"},"help":"الموضوعات التي بها منشورات حديثة"},"read":{"title":"المقروءة","help":"المواضيع التي قرأتها بترتيب قرائتك لها"},"categories":{"title":"الأقسام","title_in":"قسم - {{categoryName}}","help":"كلّ الموضوعات مجمّعة حسب القسم"},"unread":{"title":"غير المقروءة","title_with_count":{"zero":"غير المقروءة ({{count}})","one":"غير المقروءة ({{count}})","two":"غير المقروءة ({{count}})","few":"غير المقروءة ({{count}})","many":"غير المقروءة ({{count}})","other":"غير المقروءة ({{count}})"},"help":"الموضوعات التي تتابعها (أو تراقبها) والتي فيها منشورات غير مقروءة","lower_title_with_count":{"zero":"1 غير مقررء ","one":"%{count} غير مقروء","two":"{{count}} غير مقروء ","few":"{{count}} غير مقروء ","many":"{{count}} غير مقروء","other":"{{count}} غير مقروء"}},"new":{"lower_title_with_count":{"zero":"لا جديد","one":"%{count} جديد","two":"{{count}} جديد","few":"{{count}} جديد","many":"{{count}} جديد","other":"{{count}} جديدة"},"lower_title":"الجديدة","title":"الجديدة","title_with_count":{"zero":"الجديدة ({{count}})","one":"الجديدة ({{count}})","two":"الجديدة ({{count}})","few":"الجديدة ({{count}})","many":"الجديدة ({{count}})","other":"الجديدة ({{count}})"},"help":"المواضيع المنشأة في الأيّام القليلة الماضية"},"posted":{"title":"منشوراتي","help":"مواضيع نشرت بها "},"bookmarks":{"title":"العلامات المرجعية","help":"موضوعات وضعت عليها علامة مرجعية"},"category":{"title":"{{categoryName}}","title_with_count":{"zero":"{{categoryName}} ({{count}})","one":"{{categoryName}} ({{count}})","two":"{{categoryName}} ({{count}})","few":"{{categoryName}} ({{count}})","many":"{{categoryName}} ({{count}})","other":"{{categoryName}} ({{count}})"},"help":"آخر الموضوعات في قسم {{categoryName}}"},"top":{"title":"الأكثر مُشاهدة","help":"أكثر المواضيع نشاطًا في آخر عام أو شهر أو أسبوع أو يوم","all":{"title":"كل الوقت"},"yearly":{"title":"سنة"},"quarterly":{"title":"ربع سنة"},"monthly":{"title":"شهر"},"weekly":{"title":"اسبوع"},"daily":{"title":"يوم"},"all_time":"كل الوقت","this_year":"سنة","this_quarter":"ربع","this_month":"شهر","this_week":"أسبوع","today":"يوم","other_periods":"اعرض الاكثر مشاهدة"},"votes":{"title":"أصوات","help":"المواضيع الأكثر تصويتا"}},"permission_types":{"full":"انشاء / رد / مشاهدة","create_post":"رد / مشاهدة","readonly":"مشاهدة"},"lightbox":{"download":"تحميل"},"keyboard_shortcuts_help":{"title":"اختصارات لوحة المفاتيح","jump_to":{"title":"الانتقال إلي","home":"%{shortcut} الرّئيسيّة","latest":"%{shortcut} الأخيرة","new":"%{shortcut} الجديدة","unread":"%{shortcut} غير المقروء","categories":"%{shortcut} الأقسام","top":"%{shortcut} الاكثر مشاهدة","bookmarks":"%{shortcut} العلامات المرجعية","profile":"%{shortcut} الملف الشخصي","messages":"%{shortcut} الرّسائل"},"navigation":{"title":"التنقّل","jump":"%{shortcut} الانتقال الى المنشور#","back":"%{shortcut} العودة","up_down":"%{shortcut} نقل المحدد \u0026uarr; \u0026darr;","open":"%{shortcut} فتح الموضوع المحدد","next_prev":"%{shortcut} القسم التالي/السابق"},"application":{"title":"التّطبيق","create":"%{shortcut} كتابة موضوع جديد","notifications":"%{shortcut} فتح الإشعارات","hamburger_menu":"%{shortcut} فتح القائمة الرّئيسيّة","user_profile_menu":"%{shortcut}فتح قائمة المستخدم","show_incoming_updated_topics":"%{shortcut} عرض الموضوعات المحدثة","help":"%{shortcut} فتح مساعدة لوحة المفاتيح","dismiss_new_posts":"%{shortcut} تجاهل المنشورات الجديدة","dismiss_topics":"%{shortcut} تجاهل الموضوعات","log_out":"%{shortcut} تسجيل خروج"},"actions":{"title":"إجراءات","bookmark_topic":"%{shortcut} وضع/ازالة علامة مرجعية علي الموضوع","pin_unpin_topic":"%{shortcut} تثبيت/إلغاء تثبيت الموضوع","share_topic":"%{shortcut} مشاركة الموضوع","share_post":"%{shortcut} مشاركة المنشور","reply_as_new_topic":"%{shortcut} الرد كموضوع مرتبط","reply_topic":"%{shortcut} الرد على الموضوع","reply_post":"%{shortcut} الرد على المنشور","quote_post":"%{shortcut} اقتباس المنشور","like":"%{shortcut} الإعجاب بالمنشور","flag":"%{shortcut} الإبلاغ عن المنشور","bookmark":"%{shortcut} وضع علامة مرجعية علي المنشور","edit":"%{shortcut} تعديل المنشور","delete":"%{shortcut} حذف المنشور","mark_muted":"%{shortcut} كتم الموضوع","mark_regular":"%{shortcut} موضوع منظم (الإفتراضي)","mark_tracking":"%{shortcut} متابعة الموضوع","mark_watching":"%{shortcut} مراقبة الموضوع","print":"%{shortcut} طباعة الموضوع"}},"badges":{"earned_n_times":{"zero":"لم تمنح هذه الشارة ابدا","one":"مُنحت هذة الشارة مرة واحدة","two":"مُنحت هذة الشارة مرتان","few":"مُنحت هذه الشارة %{count} مرة","many":"مُنحت هذه الشارة %{count} مرة","other":"مُنحت هذه الشارة %{count} مرة"},"granted_on":"ممنوح منذ %{date}","others_count":"عدد من حصل علي نفس الشارة (%{count})","title":"الشارات","allow_title":"يمكنك استخدام هذة الشارة كلقب","multiple_grant":"يُمكن ان تُمنح هذة الشارة اكثر من مرة","badge_count":{"zero":"لا شارات","one":"شارة واحدة","two":"شارتان","few":"%{count} شارة","many":"%{count} شارة","other":"%{count} شارة"},"more_badges":{"zero":"بدون شارات","one":"شارة واحدة اكثر","two":"شارتان اكثر","few":"+%{count} اكثر","many":"+%{count} اكثر","other":"+%{count} اكثر"},"granted":{"zero":"لا يوجد ممنوحين","one":"ممنوح واحد","two":"%{count} ممنوح","few":"%{count} ممنوح.","many":"%{count} ممنوح.","other":"%{count} ممنوح."},"select_badge_for_title":"اختر شارة لتستخدمها كلقب لك.","badge_grouping":{"getting_started":{"name":"الاساسية"},"community":{"name":"المجتمعية"},"trust_level":{"name":"مستويات الثقة"},"other":{"name":"أخرى"},"posting":{"name":"النشر"}}},"tagging":{"all_tags":"كل الأوسمة","selector_all_tags":"كل الأوسمة","selector_no_tags":"لا أوسمة","changed":"الأوسمة المعدلة:","tags":"الأوسمة","choose_for_topic":"الأوسمة الإختيارية","add_synonyms":"اضافة","delete_tag":"احذف الوسم","delete_confirm":{"zero":"هل أنت متاكد انك تريد حذف هذا الوسم و إذالتة من {{count}} موضوع؟","one":"هل أنت متاكد انك تريد حذف هذا الوسم و إذالتة من موضوع واحد؟","two":"هل أنت متاكد انك تريد حذف هذا الوسم و إذالتة من {{count}} موضوع؟","few":"هل أنت متاكد انك تريد حذف هذا الوسم و إذالتة من {{count}} موضوع؟","many":"هل أنت متاكد انك تريد حذف هذا الوسم و إذالتة من {{count}} موضوع؟","other":"هل أنت متاكد انك تريد حذف هذا الوسم و إذالتة من {{count}} موضوع؟"},"delete_confirm_no_topics":"هل أنت متاكد انك تريد حذف هذا الوسم؟","rename_tag":"أعد تسمية الوسم","rename_instructions":"اختر اسما جديدا للوسم:","sort_by":"افرز ب‍:","sort_by_count":"العدد","sort_by_name":"الاسم","manage_groups":"أدرج مجموعات الأوسمة","manage_groups_description":"أنشئ مجموعات لتنظيم الأوسمة","cancel_delete_unused":"ألغِ","filters":{"without_category":"مواضيع %{tag} %{filter}","with_category":"موضوعات %{filter}%{tag} في %{category}","untagged_without_category":"مواضيع %{filter} غير الموسومة","untagged_with_category":"الموضوعات%{filter} غير الموسومة في %{category}"},"notifications":{"watching":{"title":"مُراقب"},"watching_first_post":{"title":"يُراقب فيه أول مشاركة"},"tracking":{"title":"مُتابع"},"regular":{"title":"موضوع عادي","description":"ستستقبل إشعارًا إن أشار أحد إلى @اسمك أو ردّ على مشاركتك."},"muted":{"title":"مكتوم"}},"groups":{"title":"مجموعات الأوسمة","about":"ضع الأوسمة في مجموعات ليسهل عليك إدارتها.","new":"مجموعة جديدة","tags_label":"الأوسمة في هذه المجموعة:","parent_tag_label":"التصنيف الأب","parent_tag_placeholder":"اختياري","parent_tag_description":"لا يمكن استخدام الأوسمة في هذه المجموعة ما لم يوجد الوسم الأب.","one_per_topic_label":"السماح بوسم واحد فقط من هذة المجموعة لكل موضوع","new_name":"مجموعة أوسمة جديدة","save":"حفظ","delete":"حذف","confirm_delete":"أمتأكد من حذف مجموعة الوسوم هذه؟"},"topics":{"none":{"unread":"ليست هناك مواضيع غير مقروءة.","new":"ليست هناك مواضيع جديدة.","read":"لم تقرأ أيّ موضوع بعد.","posted":"لم تنشر في أيّ موضوع بعد..","latest":"لا يوجد موضوعات حديثة.","bookmarks":"لم تقم بوضع علامات مرجعية علي اي موضوع بعد.","top":"لا يوجد موضوعات الاكثر مشاهدة."},"bottom":{"latest":"لا يوجد المزيد من الموضوعات الحديثة.","posted":"لا يوجد المزيد من الموضوعات المنشورة.","read":"لا يوجد المزيد من الموضوعات المقروءة.","new":"لا يوجد المزيد من الموضوعات الجديدة.","unread":"لا يوجد المزيد من الموضوعات غير مقروءة.","top":"لا يوجد المزيد من الموضوعات الاكثر مشاهدة.","bookmarks":"لا يوجد المزيد من الموضوعات التي عليها علامة مرجعية."}}},"invite":{"custom_message_placeholder":"ادخل رسالتك المخصصة","custom_message_template_forum":"مرحبا. عليك الانضمام إلى هذا المجتمع!","custom_message_template_topic":"مرحبا. أظن أن هذا الموضوع سيسعدك!"},"safe_mode":{"enabled":"الوضع الآمن مفعّل، لتخرج منه أغلق نافذة المتصفّح هذه"},"poll":{"voters":{"zero":"لا أحد صوّت","one":"واحد صوّت","two":"إثنان صوّتا","few":"صوّتوا","many":"صوّتوا","other":"الناخبين"},"total_votes":{"zero":"لم يصوت أحد","one":"صوت واحد","two":"صوتان","few":"مجموعة من الأصوات","many":"العديد من الأصوات","other":"مجموع الأصوات"},"average_rating":"متوسط التقييمات: \u003cstrong\u003e%{average}\u003c/strong\u003e ","multiple":{"help":{"at_least_min_options":{"zero":"لا تختر شيئا","one":"اختر خيارًا واحدًا على الأقل","two":"اختر خيارين إثنين على الأقل","few":"اختر \u003cstrong\u003e%{count}\u003c/strong\u003e خيارات على الأقل","many":"اختر \u003cstrong\u003e%{count}\u003c/strong\u003e خيارا على الأقل","other":"اختر \u003cstrong\u003e%{count}\u003c/strong\u003e خيار على الأقل"},"up_to_max_options":{"zero":"لا تختر شيئا","one":"اختر خيارا \u003cstrong\u003eواحدا\u003c/strong\u003e","two":"اختر ما حدّه \u003cstrong\u003eخيارين\u003c/strong\u003e","few":"اختر ما حدّه \u003cstrong\u003e%{count}\u003c/strong\u003e خيارات","many":"اختر ما حدّه \u003cstrong\u003e%{count}\u003c/strong\u003e خيارا","other":"اختر حتي \u003cstrong\u003e%{count}\u003c/strong\u003e خيار"},"x_options":{"zero":"لا تختر شيئا","one":"اختر خيار \u003cstrong\u003eواحد\u003c/strong\u003e","two":"اختر \u003cstrong\u003eخيارين\u003c/strong\u003e","few":"اختر \u003cstrong\u003e%{count}\u003c/strong\u003e خيارات","many":"اختر \u003cstrong\u003e%{count}\u003c/strong\u003e خيارا","other":"اختر \u003cstrong\u003e%{count}\u003c/strong\u003e خيار"},"between_min_and_max_options":"اختر بين \u003cstrong\u003e%{min}\u003c/strong\u003e و \u003cstrong\u003e%{max}\u003c/strong\u003e خيار"}},"cast-votes":{"title":"أدلِ بصوتك","label":"صوّت اﻵن!"},"show-results":{"title":"اعرض نتائج التصويت","label":"أظهر النتائج"},"hide-results":{"title":"ارجع إلى أصواتك"},"export-results":{"label":"تصدير"},"open":{"title":"افتح التّصويت","label":"افتح","confirm":"أمتأكد من فتح هذا التّصويت؟"},"close":{"title":"أغلق التّصويت","label":"أغلق","confirm":"أمتأكد من إغلاق هذا التّصويت؟"},"error_while_toggling_status":"عذرا، حدثت مشكلة في تبديل حالة هذا التّصويت.","error_while_casting_votes":"عذرا، حدث خطأ عند الإدلاء بأصواتكم.","error_while_fetching_voters":"عذرا، حدث خطأ في عرض الناخبين.","ui_builder":{"title":"انشأ تصويتا","insert":"أدرج التصويت","help":{"invalid_values":"يجب أن تكون القيمة الدّنيا أصغر من القيمة العليا.","min_step_value":"قيمة الخطوة الدنيا هي 1"},"poll_type":{"label":"النوع","regular":"اختيار من متعدد","multiple":"عدّة خيارات","number":"تقييم عددي"},"poll_result":{"label":"نتائج "},"poll_config":{"max":"الحد الأقصى","min":"الحد الأدنى","step":"الخطوة"},"poll_public":{"label":"أظهر الناخبين"},"poll_options":{"label":"أدخل خيارًا واحدًا في كل سطر"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"ابدأ برنامج تعليم الأعضاء الجدد لكل الأعضاء الجدد !","welcome_message":"أرسل إلى كلّ الاعضاء الجدد رسالة ترحيبيّة فيها دليل البدء سريع"}},"discourse_local_dates":{"relative_dates":{"today":"اليوم %{time}","tomorrow":"غداً %{time}","yesterday":"أمس%{time}"},"title":"أدخل التاريخ / الوقت","create":{"form":{"insert":"ادخل","advanced_mode":"الوضع المتقدم","simple_mode":"الوضع البسيط","timezones_title":"المناطق الزمنية لعرضها","recurring_title":"تكرار","recurring_none":"لا تكرار","date_title":"التاريخ","time_title":"الوقت","format_title":"تنسيق التاريخ","timezone":"المنطقة الزمنية","until":"حتى...","recurring":{"every_day":"كل يوم","every_week":"كل اسبوع","every_two_weeks":"كل أسبوعين","every_month":"كل شهر","every_two_months":"كل شهرين","every_three_months":"كل ثلاثة أشهر","every_six_months":"كل ستة اشهر","every_year":"كل عام"}}}},"details":{"title":"أخفي التفاصيل"},"voting":{"reached_limit":"لم يعد بإمكانك التصويت الآن، الرجاء حذف تصويت","list_votes":"قائمة تصويتاتك","votes_nav_help":"المواضيع الأكثر تصويتا","voted":"لقد صوّت على هذا الموضوع","allow_topic_voting":"السماح للمستخدمين بالتصويت على المواضيع في هاته الفئة","vote_title":"صوّت","vote_title_plural":"التصويتات","voted_title":"تم التصويت","voting_closed_title":"مغلق","voting_limit":"الحد"},"docker":{"upgrade":"نسختك من دسكورس قديمة.","perform_upgrade":"انقر هنا للترقية."}}},"zh_CN":{"js":{"dates":{"long_no_year":"M[月]D[日] HH:mm"},"action_codes":{"forwarded":"转发上述邮件"},"bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","created_with_at_desktop_reminder":"你所收藏的此帖将会在你下次使用桌面设备时被提醒。","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","invalid_custom_datetime":"你所提供的日期和时间无效，请重试。","list_permission_denied":"你没有权限查看该用户的收藏。","reminders":{"next_business_day":"下一个工作日","start_of_next_business_week":"下周一","custom":"自定义日期和时间","last_custom":"最近","none":"无需提醒","today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"drafts":{"new_private_message":"新私信草稿","abandon":{"confirm":"你已在此主题中打开了另一个草稿。 你确定要舍弃它吗？"}},"topic_count_latest":{"other":"有 {{count}} 个更新或新主题"},"topic_count_unread":{"other":"有 {{count}} 个未读主题"},"topic_count_new":{"other":"有 {{count}} 个新主题"},"uploading_filename":"上传中：{{filename}}...","clipboard":"剪贴板","pwa":{"install_banner":"你想要\u003ca href\u003e安装%{title}在此设备上吗？\u003c/a\u003e"},"choose_topic":{"title":{"search":"搜索主题","placeholder":"在此处输入主题标题、URL 或 ID"}},"choose_message":{"title":{"search":"搜索私信","placeholder":"在此处输入私信的标题、URL或ID"}},"review":{"order_by":"排序依据","in_reply_to":"回复给","explain":{"why":"解释为什么该项目最终进入队列","title":"需审核评分","formula":"公式","subtotal":"小计","min_score_visibility":"可见的最低分数","score_to_hide":"隐藏帖子的分数","take_action_bonus":{"name":"立即执行","title":"当工作人员选择采取行动时，会给标记加分。"},"user_accuracy_bonus":{"name":"用户准确性","title":"先前已同意其标记的用户将获得奖励。"},"trust_level_bonus":{"name":"信任等级","title":"待审阅项目由较高信任级别且具有较高分数的用户创建的。"},"type_bonus":{"name":"奖励类型","title":"某些可审核类型可以由管理人员加权，以使其具有更高的优先级。"}},"claim_help":{"optional":"你可以认领此条目以避免被他人审核。","required":"在你审核之前你必须认领此条目。","claimed_by_you":"你已认领此条目现在可以审核了。","claimed_by_other":"此条目仅可被\u003cb\u003e{{username}}\u003c/b\u003e审核。"},"claim":{"title":"认领该主题"},"unclaim":{"help":"移除该认领"},"settings":{"priorities":{"title":"需审核优先级"}},"grouped_by_topic":"依据主题分组","none":"没有项目需要审核","view_pending":"查看待审核","topic_has_pending":{"other":"该主题中有 \u003cb\u003e{{count}}\u003c/b\u003e 个帖等待审核中"},"title":"审核","filtered_topic":"您正在选择性地查看这一主题中的可审核内容。","show_all_topics":"显示所有主题","deleted_post":"(已删除的帖子)","deleted_user":"(已删除的用户)","user":{"bio":"简介","website":"网站","fields":"字段"},"user_percentage":{"summary":{"other":"{{agreed}}，{{disagreed}}，{{ignored}}（共{{count}}个标记）"},"agreed":{"other":"{{count}}%同意"},"disagreed":{"other":"{{count}}%不同意"},"ignored":{"other":"{{count}}%忽略"}},"topics":{"reviewable_count":"计数","reported_by":"报告人","deleted":"[已删除的主题]","original":"（原主题）","unique_users":{"other":"{{count}} 位用户"}},"replies":{"other":"{{count}} 个回复"},"new_topic":"批准此条目将会创建一个新的主题","filters":{"type":{"all":"(全部类型)"},"minimum_score":"最低分：","status":"状态","orders":{"priority":"优先级","priority_asc":"优先级（倒序）","created_at":"创建时间","created_at_asc":"创建时间（倒序）"},"priority":{"title":"最低优先级","low":"（所有）","medium":"中","high":"高"}},"conversation":{"view_full":"查看完整对话"},"scores":{"about":"该分数是根据报告者的信任等级、该用户以往举报的准确性以及被举报条目的优先级计算得出的。","score":"评分","status":"状态","submitted_by":"提交人","reviewed_by":"审核者"},"statuses":{"approved":{"title":"已批准"},"ignored":{"title":"忽略"},"reviewed":{"title":"（所有已审核）"},"all":{"title":"（全部）"}},"types":{"reviewable_flagged_post":{"title":"被标记的帖子","flagged_by":"标记者"},"reviewable_queued_topic":{"title":"队列中到主题"},"reviewable_queued_post":{"title":"队列中的帖子"}},"approval":{"pending_posts":{"other":"你有 \u003cstrong\u003e{{count}}\u003c/strong\u003e 个帖子在等待审核中。"}}},"groups":{"member_requested":"请求于","add_members":{"description":"管理该群组的成员"},"requests":{"title":"请求","accept":"接受","deny":"拒绝","denied":"已拒绝","undone":"撤销请求","handle":"处理成员请求"},"empty":{"requests":"没有请求加入此群组的请求。"},"confirm_leave":"你确定要离开这个群组吗？","allow_membership_requests":"允许用户向群组所有者发送成员资格请求（需要公开可见的群组）","group_name":"群组名","index":{"filter":"根据群组类型筛选","close_groups":"关闭的群组","automatic_groups":"自动群组","public":"公开","private":"私密","public_groups":"公开的群组","close_group":"关闭群组"},"members":{"filter_placeholder_admin":"用户名或电子邮件","remove_member_description":"从群组中移除\u003cb\u003e%{username}\u003c/b\u003e","make_owner":"设为所有者","make_owner_description":"使\u003cb\u003e%{username}\u003c/b\u003e成为群组所有者","remove_owner_description":"把\u003cb\u003e%{username}\u003c/b\u003e从群组所有者中移除","forbidden":"你不可以查看成员列表。"},"alias_levels":{"owners_mods_and_admins":"仅群组成员、版主与管理员"},"notifications":{"watching_first_post":{"description":"你将收到有关此组中新消息的通知，但不会回复消息。"},"muted":{"description":"你不会收到有关此组中消息的任何通知。"}},"flair_url_description":"使用不小于20px × 20px的方形图像或FontAwesome图标（可接受的格式：“fa-icon”，“far fa-icon”或“fab fa-icon”）。"},"user_action_groups":{"15":"草稿"},"categories":{"topic_stat_sentence_week":{"other":"过去一周有%{count}个新主题。"},"topic_stat_sentence_month":{"other":"过去一个月有%{count}个新主题。"},"n_more":"分类 (还有%{count}个分类) ..."},"ip_lookup":{"powered_by":"使用\u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e"},"user":{"user_notifications":{"ignore_duration_title":"忽略计时器","ignore_duration_when":"持续时间：","ignore_duration_note":"请注意所有忽略的项目会在忽略的时间段过去后被自动移除","ignore_duration_time_frame_required":"请选择时间范围","ignore_no_users":"你没有忽视任何用户","ignore_option":"忽略","ignore_option_title":"你将不会收到关于此用户的通知并且隐藏其所有帖子及回复。","add_ignored_user":"添加...","mute_option_title":"你不会收到任何关于此用户的通知","normal_option_title":"如果用户回复、引用或提到你，你将会收到消息。"},"feature_topic_on_profile":{"open_search":"选择一个新主题","title":"选择一个主题","search_label":"通过标题搜索主题","clear":{"warning":"你确定要清除精选主题吗？"}},"use_current_timezone":"使用现在的时区","dynamic_favicon":"在浏览器图标上显示计数","theme_default_on_all_devices":"将其设为我所有设备上的默认主题","text_size_default_on_all_devices":"将其设为我所有设备上的默认字体大小","allow_private_messages":"允许其他用户发送私信给我","enable_defer":"启用延迟以标记未读主题","featured_topic":"精选主题","silenced_tooltip":"该用户已被禁言。","mailing_list_mode":{"warning":"邮件列表模式启用。邮件通知设置被覆盖。"},"muted_categories_instructions":"你不会收到有关这些分类中新主题的任何通知，也不会出现在类别或最新页面上。","muted_categories_instructions_dont_hide":"你将不会收到在这些分类中的新主题通知。","delete_yourself_not_allowed":"想删除账户请联系管理人员。","ignored_users":"忽视","ignored_users_instructions":"封禁所有来自这些用户的帖子和通知。","api_last_used_at":"最后使用于：","staged":"暂存","staff_counters":{"rejected_posts":"被驳回的帖子"},"second_factor_backup":{"title":"两步备份码","enable_long":"启用备份码","manage":"管理备份码。你还剩下\u003cstrong\u003e{{count}}\u003c/strong\u003e个备份码。","remaining_codes":"你有\u003cstrong\u003e{{count}}\u003c/strong\u003e个备份码","use":"使用备份码","enable_prerequisites":"你必须在生成备份代码之前启用主要第二因素。","codes":{"title":"备份码生成","description":"每个备份码只能使用一次。请存放于安全可读的地方。"}},"second_factor":{"title":"双重验证","enable":"管理两步验证","forgot_password":"忘记密码？","confirm_password_description":"请确认密码后继续","rate_limit":"请等待另一个验证码。","enable_description":"使用我们支持的应用 (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) 扫描此二维码并输入您的授权码。\n","extended_description":"双重验证要求你的密码之外的一次性令牌，从而为你的账户增加了额外的安全性。可以在\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e和\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e设备上生成令牌。\n","use":"使用身份验证器应用","enforced_notice":"在访问此站点之前，你需要启用双重身份验证。","disable":"停用","disable_title":"禁用次要身份验证器","disable_confirm":"确定禁用所有的两步验证吗？","edit_title":"编辑次要身份验证器","edit_description":"次要身份验证器名称","enable_security_key_description":"当你准备好物理安全密钥后，请按下面的“注册”按钮。","totp":{"title":"基于凭证的身份验证器","add":"新增身份验证器","default_name":"我的身份验证器","name_and_code_required_error":"你必须提供你的身份验证器应用的名称和代码。"},"security_key":{"register":"注册","title":"安全密钥","add":"注册安全密钥","default_name":"主要安全密钥","not_allowed_error":"安全密钥注册过程已超时或被取消。","already_added_error":"你已注册此安全密钥，无需再次注册。","edit":"编辑安全密钥","edit_description":"安全密钥名称","name_required_error":"你必须提供安全密钥的名称。"}},"change_username":{"confirm":"你确定要更改用户名吗？"},"change_avatar":{"gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e，基于","gravatar_title":"在{{gravatarName}}网站修改你的头像","gravatar_failed":"我们无法找到此电子邮件的{{gravatarName}}。","refresh_gravatar_title":"刷新你的{{gravatarName}}"},"change_profile_background":{"title":"个人档头部","instructions":"个人资料的页头会被居中显示且默认宽度为1110px。"},"change_featured_topic":{"title":"精选主题","instructions":"此主题的链接会显示在你的用户卡片和资料中。"},"email":{"primary":"主邮箱","secondary":"次邮箱","no_secondary":"没有次邮箱","sso_override_instructions":"电子邮件地址可以通过SSO登录来更新。","instructions":"绝不会被公开显示"},"associated_accounts":{"title":"关联账户","connect":"连接","not_connected":"（没有连接）","confirm_modal_title":"连接%{provider}帐号","confirm_description":{"account_specific":"你的%{provider}帐号“%{account_description}”会被用作认证。","generic":"你的%{provider}帐号会被用作认证。"}},"invite_code":{"title":"邀请码","instructions":"账户注册需要邀请码"},"auth_tokens":{"title":"最近使用的设备","log_out_all":"全部登出","active":"现在活跃","not_you":"不是你？","show_all":"显示所有（{{count}}）","show_few":"显示部分","was_this_you":"这是你吗？","was_this_you_description":"如果不是你，我们建议你更改密码并在任何地方注销。","browser_and_device":"{{browser}}在{{device}}","secure_account":"保护我的账户","latest_post":"你上次发布了......"},"hide_profile_and_presence":"隐藏我的公开个人资料和状态功能","enable_physical_keyboard":"在iPad上启用物理键盘支持","text_size":{"title":"文本大小","smaller":"更小","larger":"更大","largest":"最大"},"title_count_mode":{"title":"背景页面标题显示计数：","notifications":"新通知","contextual":"新建页面内容"},"email_digests":{"title":"长期未访问时发送热门主题和回复的摘要邮件"},"email_level":{"only_when_away":"只在离开时"},"invited":{"sent":"上次发送","none":"无邀请显示。","rescind_all":"移除所有过期邀请","rescinded_all":"所有过期邀请已删除！","rescind_all_confirm":"你确定你想要移除所有过期邀请么？","bulk_invite":{"confirmation_message":"你将通过电子邮件将邀请发送给在上传的文件中的每一个人。"}},"summary":{"likes_given":{"other":"送出"},"likes_received":{"other":"收到"},"topics_entered":{"other":"已阅主题"}},"title":{"none":"（无）"},"primary_group":{"none":"（无）"}},"modal":{"dismiss_error":"忽略错误"},"logs_error_rate_notice":{},"time_read_recently":"最近 %{time_read}","time_read_tooltip":"合计阅读时间 %{time_read}","time_read_recently_tooltip":"总阅读时间 %{time_read}（最近60天 %{recent_time_read}）","signup_cta":{"intro":"你好！看起来你正在享受讨论，但还没有注册一个账户。","value_prop":"当你创建了账户，我们就可以准确地记录你的阅读进度，你再次访问时就可以回到之前离开的地方。当有人回复你，你可以通过这里或电子邮件收到通知。并且你还可以通过点赞帖子向他人分享你的喜爱之情。:heartbeat:"},"private_message_info":{"invite":"邀请其他人...","edit":"添加或移除...","leave_message":"你真的想要发送消息么？"},"create_account":{"disclaimer":"注册即表示你同意\u003ca href='{{privacy_link}}' target='blank'\u003e隐私策略\u003c/a\u003e和\u003ca href='{{tos_link}}' target='blank'\u003e服务条款\u003c/a\u003e。"},"forgot_password":{"complete_username_found":"我们找到一个与用户名\u003cb\u003e%{username}\u003c/b\u003e匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。","complete_email_found":"我们找到一个与\u003cb\u003e%{email}\u003c/b\u003e相匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。"},"email_login":{"link_label":"给我通过邮件发送一个登录链接","complete_username":"如果有一个与用户名\u003cb\u003e%{username}\u003c/b\u003e相匹配的账户，你很快就会收到一封带有登录链接的电子邮件。","complete_email":"如果\u003cb\u003e%{email}\u003c/b\u003e与账户相匹配，你很快就会收到一封带有登录链接的电子邮件。","complete_username_found":"我们找到了一个与用户名\u003cb\u003e%{username}\u003c/b\u003e相匹配的账户，你很快就会收到一封带有登录链接的电子邮件。","complete_email_found":"我们发现了一个与\u003cb\u003e%{email}\u003c/b\u003e相匹配的账户，你很快就会收到一封带有登录链接的电子邮件。","logging_in_as":"用%{email}登录","confirm_button":"登录完成"},"login":{"second_factor_title":"双重验证","second_factor_description":"请输入来自 app 的验证码：","second_factor_backup":"使用备用码登录","second_factor_backup_title":"两步验证备份","second_factor_backup_description":"请输入你的备份码：","second_factor":"使用身份验证器app登录","security_key_description":"当你准备好物理安全密钥后，请按下面的“使用安全密钥进行身份验证”按钮。","security_key_alternative":"尝试另一种方式","security_key_authenticate":"使用安全密钥进行身份验证","security_key_not_allowed_error":"安全密钥验证超时或被取消。","security_key_no_matching_credential_error":"在提供的安全密钥中找不到匹配的凭据。","security_key_support_missing_error":"您当前的设备或浏览器不支持使用安全密钥。请使用其他方法。","cookies_error":"你的浏览器似乎禁用了Cookie。如果不先启用它们，你可能无法登录。","blank_username":"请输入你的邮件地址或用户名。","omniauth_disallow_totp":"你的账户已启用双重验证，请使用密码登录。","sent_activation_email_again_generic":"我们发送了另一封激活邮件。它可能需要几分钟才能到达；记得检查你的垃圾邮件文件夹。","instagram":{"name":"Instagram"},"facebook":{"name":"Facebook"},"github":{"name":"GitHub"},"discord":{"name":"Discord","title":"with Discord"},"second_factor_toggle":{"totp":"改用身份验证APP","backup_code":"使用备份码"}},"emoji_set":{"emoji_one":"JoyPixels （曾用名EmojiOne）"},"category_page_style":{"categories_and_top_topics":"分类和最热主题","categories_boxes":"带子分类的框","categories_boxes_with_topics":"有特色主题的框"},"shortcut_modifier_key":{"enter":"回车"},"category_row":{"topic_count":"{{count}}个主题在此分类中"},"select_kit":{"create":"创建：“{{content}}”","max_content_reached":{"other":"你只能选择 {{count}} 条记录。"},"min_content_not_reached":{"other":"选择至少{{count}}条。"},"invalid_selection_length":"选择的字符至少为{{count}}个字符。"},"date_time_picker":{"errors":{"to_before_from":"截至日期必须晚于开始日期。"}},"emoji_picker":{"smileys_\u0026_emotion":"笑脸与情感","people_\u0026_body":"人与身体","animals_\u0026_nature":"动物与自然","food_\u0026_drink":"饮食","travel_\u0026_places":"旅行与地点","activities":"活动","symbols":"符号"},"shared_drafts":{"title":"共享草稿","notice":"只有那些可以看到\u003cb\u003e{{category}}\u003c/b\u003e分类的人才能看到此主题。","destination_category":"目标分类","publish":"发布共享草稿","confirm_publish":"你确定要发布此草稿吗？","publishing":"发布主题中......"},"composer":{"edit_conflict":"编辑冲突","group_mentioned_limit":"\u003cb\u003e警告！\u003c/b\u003e你提到了\u003ca href='{{group_link}}'\u003e {{group}} \u003c/a\u003e，但该群组的成员数超过了的管理员配置的最大{{max}}人数。没人会收到通知。","reference_topic_title":"回复：{{title}}","error":{"post_missing":"帖子不能为空","try_like":"试试{{heart}}按钮？","tags_missing":"你必须至少选择{{count}}个标签","topic_template_not_modified":"请通过编辑主题模板来为主题添加详情。"},"overwrite_edit":"覆盖编辑","create_whisper":"密语","create_shared_draft":"创建共享草稿","edit_shared_draft":"编辑共享草稿","reply_placeholder_no_images":"在此输入。 使用 Markdown，BBCode 或 HTML 格式。","reply_placeholder_choose_category":"输入前请选择一个分类。","saved_draft":"正在发布草稿。点击以继续。","link_url_placeholder":"粘贴 URL 或键入以搜索主题","toggle_direction":"切换方向","collapse":"最小化编辑面板","open":"打开编辑面板","abandon":"关闭编辑面板并放弃草稿","enter_fullscreen":"进入全屏编辑模式","exit_fullscreen":"退出全屏编辑模式","composer_actions":{"draft":"草稿","reply_to_post":{"label":"通过%{postUsername}回复帖子%{postNumber}","desc":"回复特定帖子"},"reply_as_new_topic":{"label":"回复为联结主题","desc":"创建一个新主题链接到这一主题","confirm":"您保存了新的主题草稿，如果您创建链接主题该草稿将被覆盖。"},"reply_as_private_message":{"label":"新消息","desc":"新建一个私信"},"reply_to_topic":{"label":"回复主题","desc":"回复主题，不是任何特定的帖子"},"toggle_whisper":{"label":"切换密语","desc":"只有管理人员才能看到密语"},"shared_draft":{"label":"共享草稿","desc":"起草一个只对管理人员可见的主题"},"toggle_topic_bump":{"label":"切换主题置顶","desc":"回复而不更改最新回复日期"}}},"notifications":{"tooltip":{"regular":{"other":"{{count}} 个未读通知"},"message":{"other":"{{count}} 条未读私信"},"high_priority":{"other":"%{count}个未读的高优先级通知"}},"post_approved":"你的帖子已被审核","reviewable_items":"待审核帖子","liked_consolidated_description":{"other":"你的帖子有{{count}}个赞"},"membership_request_accepted":"接受来自“{{group_name}}”的邀请","membership_request_consolidated":"{{count}}个加入“{{group_name}}”群组的请求","popup":{"private_message":"{{username}}在“{{topic}}”中向你发送了个人消息 - {{site_title}}","watching_first_post":"{{username}}发布了新主题“{{topic}}” - {{site_title}}","confirm_title":"通知已启用 - %{site_title}","confirm_body":"成功！通知已启用。","custom":"来自{{username}}在%{site_title}的通知"},"titles":{"mentioned":"提及到","replied":"新回复","quoted":"引用","edited":"编辑","liked":"新到赞","private_message":"新私信","invited_to_private_message":"邀请进行私下交流","invitee_accepted":"邀请已接受","posted":"新帖子","moved_post":"帖子已移动","linked":"链接","bookmark_reminder":"收藏提醒","bookmark_reminder_with_name":"收藏提醒 - %{name}","granted_badge":"勋章授予","invited_to_topic":"邀请到主题","group_mentioned":"群组提及","group_message_summary":"新建群组消息","topic_reminder":"主题提醒","liked_consolidated":"新的赞","post_approved":"帖子已审批","membership_request_consolidated":"新的成员申请"}},"search":{"result_count":{"other":"\u003cspan\u003e{{count}}{{plus}}结果\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"full_page_title":"搜索主题或帖子","results_page":"关于“{{term}}”的搜索结果","context":{"tag":"搜索＃{{tag}}标签"},"advanced":{"in_category":{"label":"分类"},"filters":{"label":"只返回主题/帖子……","title":"仅在标题中匹配","created":"我创建的","private":"在我的私信中","images":"包含图片","all_tags":"上述所有标签"},"statuses":{"public":"是公开的"}}},"view_all":"查看全部","topic":{"open_draft":"打开草稿","edit_message":{"help":"编辑消息中的第一帖"},"defer":{"help":"标记为未读"},"feature_on_profile":{"help":"添加此主题的链接到你的用户卡片和资料中。","title":"精选到个人资料"},"remove_from_profile":{"warning":"你的个人资料中已存在精选主题。如果继续，此主题会替换存在的主题。","help":"在你的个人资料中移除指向该主题的链接","title":"从个人资料中移除"},"group_request":"你需要请求加入`{{name}}`群组才能查看此主题。","group_join":"你需要加入`{{name}}`群组以查看此主题","group_request_sent":"你加入群组的请求已发送。当被接受时你会收到通知。","unread_indicator":"还没有成员读过此主题的最新帖子。","topic_status_update":{"title":"主题计时器","num_of_days":"天数","public_timer_types":"主题计时器","private_timer_types":"用户主题计时器","time_frame_required":"请选择一个时间范围"},"auto_update_input":{"none":"选择时间范围","two_weeks":"两周","two_months":"两个月","three_months":"三个月","four_months":"四个月","six_months":"六个月"},"auto_bump":{"title":"自动顶帖"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_bump":"此主题将在%{timeLeft}后自动顶起。","auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"progress":{"jump_prompt_long":"跳到……","jump_prompt_to_date":"至今"},"actions":{"make_private":"设置为私信","reset_bump_date":"重置顶帖日期"},"share":{"extended_title":"分享一个链接"},"make_public":{"title":"转换到公开主题","choose_category":"请选择公共主题分类："},"move_to":{"title":"移动到","action":"移动到","error":"移动帖子时发生了错误。"},"split_topic":{"topic_name":"新主题的标题"},"merge_topic":{"radio_label":"现存的主题"},"move_to_new_message":{"title":"移动到新的即时信息","action":"移动到新的私信","message_title":"新私信的标题","participants":"参与者","instructions":{"other":"你正在发送\u003cb\u003e{{count}}\u003c/b\u003e篇帖子到一条新的私信/消息。"}},"move_to_existing_message":{"title":"移动到现存的私信","action":"移动到已存在的私信","radio_label":"现存的私信","participants":"参与者","instructions":{"other":"请选择你要将\u003cb\u003e{{count}}\u003c/b\u003e个帖子所移动到的私信。"}},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"title":"更改所有者","instructions":{"other":"请选择\u003cb\u003e@{{old_user}}\u003c/b\u003e创建的{{count}}个帖子的新作者。"},"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}},"multi_select":{"select_post":{"title":"将帖子加入选择"},"selected_post":{"title":"单击以将帖子从中移除"},"select_replies":{"title":"选择帖子及其所有回复"},"select_below":{"label":"选择 +以下","title":"选择帖子及其后的所有内容"}},"deleted_by_author":{"other":"（主题被作者撤回，除非被标记，不然将在%{count}小时后自动删除）"}},"post":{"ignored":"忽视的内容","show_hidden":"显示已忽略内容。","collapse":"折叠","locked":"一管理人员锁定了该帖的编辑","notice":{"new_user":"这是 {{user}} 发的第一个帖子 - 让我们欢迎他加入社区！","returning_user":"从我们上一次看到 {{user}} 有一阵子了 — 他上次发帖是 {{time}}."},"errors":{"file_too_large":"抱歉，该文件太大（最大大小为 {{max_size_kb}}KB）。为什么不将您的大文件上传到云共享服务，然后粘贴链接？","too_many_dragged_and_dropped_files":"抱歉，你一次只能上传最多{{max}}个文件。"},"abandon_edit":{"confirm":"您确定要放弃所做的更改吗？","no_save_draft":"不，保存草稿","yes_value":"是的，忽略编辑"},"abandon":{"no_save_draft":"不，保存草稿"},"controls":{"read_indicator":"阅读了帖子的用户","delete_replies":{"confirm":"你也想删除该贴的回复？","direct_replies":{"other":"是，{{count}}个直接回复"},"all_replies":{"other":"是，所有{{count}}个回复"}},"lock_post":"锁定帖子","lock_post_description":"禁止发帖者编辑这篇帖子","unlock_post":"解锁帖子","unlock_post_description":"允许发布者编辑帖子","delete_topic_disallowed_modal":"你无权删除该贴。如果你真想删除，向版主提交原因并标记。","delete_topic_disallowed":"你无权删除此主题","add_post_notice":"添加管理人员通知","remove_post_notice":"移除管理人员通知","remove_timer":"移除计时器"},"actions":{"defer_flags":{"other":"忽略标记"},"people":{"like":{"other":"点赞"},"read":{"other":"看过"},"like_capped":{"other":"和其他 {{count}} 人赞了它"},"read_capped":{"other":"还有{{count}}个其他用户看过"}}},"delete":{"confirm":{"other":"你确定要删除{{count}}个帖子吗？"}},"revisions":{"controls":{"comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"}},"bookmarks":{"create":"创建收藏夹","edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"delete_bookmark":{"name":"删除收藏","description":"从你的个人资料中删除收藏并停止所有有关该收藏的提醒"},"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"category":{"choose":"分类\u0026hellip;","edit_dialog_title":"编辑: %{categoryName}","tags_allowed_tags":"限制这些标签只能用在此分类","tags_allowed_tag_groups":"限制这些标签组只能用在此分类","tags_tab_description":"上面所指定的标签和标签组仅在此分类以及其它也指定了它们的分类中可用。它们将无法在其它分类中使用。","manage_tag_groups_link":"管理这里的标签组。","allow_global_tags_label":"也允许其它标签","tag_group_selector_placeholder":"（可选）标签组","required_tag_group_description":"要求新主题包含标签组中的标签：","min_tags_from_required_group_label":"标签数量：","required_tag_group_label":"标签组：","uncategorized_security_warning":"这是个特殊的分类。如果不知道应该话题属于哪个分类，那么请使用这个分类。这个分类没有安全设置。","uncategorized_general_warning":"这个分类是特殊的。它用作未选择分类的新主题的默认分类。如果你想要避免此行为并强制选择分类，\u003ca href=\"%{settingLink}\"\u003e请在此处禁用该设置\u003c/a\u003e。如果你要修改其名称或描述，请转到\u003ca href=\"%{customizeLink}\"\u003e自定义/文本内容\u003c/a\u003e。","pending_permission_change_alert":"你还没有添加%{group}到此分类；点击此按钮添加。","mailinglist_mirror":"分类镜像了一个邮件列表","all_topics_wiki":"默认将新主题设为维基主题","reviewable_by_group":"管理人员之外，可以审核该分类中的帖子和标记的人：","require_topic_approval":"所有新主题需要版主审批","require_reply_approval":"所有新回复需要版主审批","position":"分类页面位置：","minimum_required_tags":"在一个主题中至少含有多少个标签：","num_auto_bump_daily":"每天自动碰撞的主题的数量","navigate_to_first_post_after_read":"阅读主题后导航到第一个帖子","notifications":{"watching_first_post":{"description":"你将收到此分类中的新主题通知，不包括回复。"}},"search_priority":{"options":{"very_low":"非常低","low":"低","high":"高","very_high":"非常高"}},"settings_sections":{"moderation":"审核"}},"topic_statuses":{"personal_message":{"title":"此主题是一条私信","help":"此主题是一条私信"}},"browser_update":"抱歉，\u003ca href=\"http://www.discourse.com/faq/#browser\"\u003e你的浏览器版本太低，无法正常访问该站点\u003c/a\u003e。请\u003ca href=\"http://browsehappy.com\"\u003e升级你的浏览器\u003c/a\u003e。","lightbox":{"previous":"上一个（左方向键）","next":"下一个（右方向键）","counter":"%curr% / %total%","close":"关闭(Esc)","content_load_error":"\u003ca href=\"%url%\"\u003e内容\u003c/a\u003e无法加载","image_load_error":"\u003ca href=\"%url%\"\u003e图像\u003c/a\u003e无法加载"},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":"，","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1}或%{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1}%{shortcut2}","jump_to":{"drafts":"%{shortcut}草稿"},"navigation":{"go_to_unread_post":"%{shortcut}前往第一个未读帖子"},"application":{"search":"%{shortcut} 搜索"},"composing":{"title":"编辑","return":"%{shortcut}返回编辑器","fullscreen":"%{shortcut}全屏编辑器"},"bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"actions":{"defer":"%{shortcut}延迟主题","topic_admin_actions":"%{shortcut}打开主题管理"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}},"badges":{"none":"（无）","successfully_granted":"成功将 %{badge} 授予 %{username}"},"tagging":{"other_tags":"其他标签","info":"详情","default_info":"该标签不限于任何类别，并且没有同义词。","category_restricted":"此标签仅限于你无权访问的分类。","synonyms":"同义词","synonyms_description":"使用以下标签时，它们将被替换为\u003cb\u003e%{base_tag_name}\u003c/b\u003e 。","tag_groups_info":{"other":"此标签属于这些标签组：{{tag_groups}}。"},"category_restrictions":{"other":"只能在这些分类中使用："},"edit_synonyms":"管理同义词","add_synonyms_label":"添加同义词：","add_synonyms_explanation":{"other":"当前任何使用了此标签的地方都将被改为使用\u003cb\u003e%{tag_name}\u003c/b\u003e代替。你确定要应用此更改吗？"},"add_synonyms_failed":"不能将以下标记添加为同义词： \u003cb\u003e%{tag_names}\u003c/b\u003e 。确保它们没有同义词并且不是其他标签的同义词。","remove_synonym":"删除同义词","delete_synonym_confirm":"您确定要删除同义词“ %{tag_name}”吗？","delete_confirm_synonyms":{"other":"其{{count}}个同义词也将被删除。"},"upload":"上传标签","upload_description":"上传csv文件以批量创建标签","upload_instructions":"每行一个，可选带有'tag_name，tag_group'格式的标签组。","upload_successful":"标签上传成功","delete_unused_confirmation":{"other":"%{count}标签将被删除：%{tags}"},"delete_unused_confirmation_more_tags":{"other":"%{tags}和%{count}更多"},"delete_unused":"删除未使用的标签","delete_unused_description":"删除所有未与主题或私信关联的标签","notifications":{"watching":{"description":"你将自动监看所有含有此标签的主题。你将收到所有新帖子和主题的通知，此外，主题旁边还会显示未读和新帖子的数量。"},"watching_first_post":{"description":"你将会收到此标签中的新主题的通知，但对主题的回复则不会。"},"tracking":{"description":"你将自动监看所有含有此标签的主题。未读和新帖的计数将显示在主题旁边。"},"muted":{"description":"你不会收到任何含有此标签的新主题的通知，也不会在未读栏。"}},"groups":{"tags_placeholder":"标签","name_placeholder":"标签组名称","everyone_can_use":"每个人都可以使用标签","usable_only_by_staff":"标签对所有人可见，但只有管理人员可以使用它们","visible_only_to_staff":"标签仅对管理人员可见"}},"invite":{"custom_message":"通过编写\u003ca href\u003e自定义消息\u003c/a\u003e，使你的邀请更个性化。"},"forced_anonymous":"由于极端负载，暂时向所有人显示，已注销用户会看到它。","poll":{"public":{"title":"投票为\u003cstrong\u003e公开\u003c/strong\u003e。"},"results":{"groups":{"title":"你需要成为 %{groups} 的一员才能投票。"},"vote":{"title":"结果将显示在\u003cstrong\u003e投票\u003c/strong\u003e上。"},"closed":{"title":"结果将显示一次\u003cstrong\u003e关闭\u003c/strong\u003e。"},"staff":{"title":"结果仅显示给\u003cstrong\u003e管理\u003c/strong\u003e成员。"}},"hide-results":{"label":"显示投票"},"group-results":{"title":"按用户字段分组投票","label":"显示错误"},"ungroup-results":{"title":"合并所有投票","label":"隐藏错误"},"export-results":{"title":"到处投票结果"},"automatic_close":{"closes_in":"于\u003cstrong\u003e%{timeLeft}\u003c/strong\u003e关闭。","age":"\u003cstrong\u003e%{age}\u003c/strong\u003e关闭"},"error_while_exporting_results":"抱歉，导出投票结果时出错。","ui_builder":{"help":{"options_count":"至少输入1个选项"},"poll_result":{"always":"总是可见","vote":"投票","closed":"关闭时","staff":"仅管理人员"},"poll_groups":{"label":"允许的群组"},"poll_chart_type":{"label":"图表类型"},"automatic_close":{"label":"自动关闭投票"}}},"discourse_local_dates":{"relative_dates":{"countdown":{"passed":"日期已过"}},"create":{"form":{"format_description":"向用户显示日期的格式。 使用“\\T\\Z”以单词显示用户时区（欧洲/巴黎）","timezones_description":"时区将用于在预览和撤回中显示日期。","recurring_description":"定义重复事件。你还可以手动编辑表单生成的周期性选项，并使用以下键之一：年，季，月，周，日，小时，分钟，秒，毫秒。","invalid_date":"日期无效，请确保日期和时间正确"}}},"presence":{"replying":"正在回复","editing":"正在编辑","replying_to_topic":{"other":"正在回复"}},"voting":{"title":"投票","votes_left":{"other":"你还有 {{count}} 张选票，查看\u003ca href='{{path}}'\u003e你的投票\u003c/a\u003e。"},"votes":{"other":"{{count}} 票"},"anonymous_button":{"other":"投票"},"remove_vote":"移除投票"},"adplugin":{"advertisement_label":"广告"}}},"en":{"js":{"topic_count_latest":{"one":"See {{count}} new or updated topic"},"topic_count_unread":{"one":"See {{count}} unread topic"},"topic_count_new":{"one":"See {{count}} new topic"},"review":{"topic_has_pending":{"one":"This topic has \u003cb\u003e%{count}\u003c/b\u003e post pending approval"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} total flag)"},"agreed":{"one":"{{count}}% agree"},"disagreed":{"one":"{{count}}% disagree"},"ignored":{"one":"{{count}}% ignore"}},"topics":{"unique_users":{"one":"%{count} user"}},"replies":{"one":"%{count} reply"},"approval":{"pending_posts":{"one":"You have \u003cstrong\u003e%{count}\u003c/strong\u003e post pending."}}},"categories":{"topic_stat_sentence_week":{"one":"%{count} new topic in the past week."},"topic_stat_sentence_month":{"one":"%{count} new topic in the past month."}},"user":{"change_password":{"emoji":"lock emoji"},"summary":{"likes_given":{"one":"given"},"likes_received":{"one":"received"},"topics_entered":{"one":"topic viewed"}}},"local_time":"Local Time","email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"select_kit":{"max_content_reached":{"one":"You can only select {{count}} item."},"min_content_not_reached":{"one":"Select at least {{count}} item."}},"notifications":{"tooltip":{"regular":{"one":"%{count} unseen notification"},"message":{"one":"%{count} unread message"},"high_priority":{"one":"%{count} unread high priority notification"}},"liked_consolidated_description":{"one":"liked {{count}} of your posts"}},"search":{"result_count":{"one":"\u003cspan\u003e%{count} result for\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"}},"topic":{"move_to_new_message":{"instructions":{"one":"You are about to create a new message and populate it with the post you've selected."}},"move_to_existing_message":{"instructions":{"one":"Please choose the message you'd like to move that post to."}},"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions":{"one":"Please choose a new owner for the post by \u003cb\u003e@{{old_user}}\u003c/b\u003e"},"instructions_without_old_user":{"one":"Please choose a new owner for the post"}},"deleted_by_author":{"one":"(topic withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"}},"post":{"controls":{"delete_replies":{"direct_replies":{"one":"Yes, and %{count} direct reply"},"all_replies":{"one":"Yes, and %{count} reply"}},"publish_page":"Page Publishing"},"actions":{"defer_flags":{"one":"Ignore flag"},"people":{"like":{"one":"liked this"},"read":{"one":"read this"},"like_capped":{"one":"and {{count}} other liked this"},"read_capped":{"one":"and {{count}} other read this"}}},"delete":{"confirm":{"one":"Are you sure you want to delete that post?"}}},"tagging":{"tag_groups_info":{"one":"This tag belongs to the group \"{{tag_groups}}\"."},"category_restrictions":{"one":"It can only be used in this category:"},"add_synonyms_explanation":{"one":"Any place that currently uses this tag will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?"},"delete_confirm_synonyms":{"one":"Its synonym will also be deleted."},"delete_unused_confirmation":{"one":"%{count} tag will be deleted: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} and %{count} more"}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"presence":{"replying_to_topic":{"one":"replying"}},"voting":{"votes_left":{"one":"You have {{count}} vote left, see \u003ca href='{{path}}'\u003eyour votes\u003c/a\u003e."},"votes":{"one":"{{count}} vote"},"anonymous_button":{"one":"Vote"}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'ar';
I18n.pluralizationRules.ar = MessageFormat.locale.ar;
//! moment.js

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, (function () { 'use strict';

    var hookCallback;

    function hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
    }

    function isObject(input) {
        // IE8 will treat undefined and null as object if it wasn't for
        // input != null
        return input != null && Object.prototype.toString.call(input) === '[object Object]';
    }

    function isObjectEmpty(obj) {
        if (Object.getOwnPropertyNames) {
            return (Object.getOwnPropertyNames(obj).length === 0);
        } else {
            var k;
            for (k in obj) {
                if (obj.hasOwnProperty(k)) {
                    return false;
                }
            }
            return true;
        }
    }

    function isUndefined(input) {
        return input === void 0;
    }

    function isNumber(input) {
        return typeof input === 'number' || Object.prototype.toString.call(input) === '[object Number]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false,
            parsedDateParts : [],
            meridiem        : null,
            rfc2822         : false,
            weekdayMismatch : false
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    var some;
    if (Array.prototype.some) {
        some = Array.prototype.some;
    } else {
        some = function (fun) {
            var t = Object(this);
            var len = t.length >>> 0;

            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(this, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }

    function isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            var parsedParts = some.call(flags.parsedDateParts, function (i) {
                return i != null;
            });
            var isNowValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.weekdayMismatch &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated &&
                (!flags.meridiem || (flags.meridiem && parsedParts));

            if (m._strict) {
                isNowValid = isNowValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }

            if (Object.isFrozen == null || !Object.isFrozen(m)) {
                m._isValid = isNowValid;
            }
            else {
                return isNowValid;
            }
        }
        return m._isValid;
    }

    function createInvalid (flags) {
        var m = createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    var momentProperties = hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (!isUndefined(from._isAMomentObject)) {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (!isUndefined(from._i)) {
            to._i = from._i;
        }
        if (!isUndefined(from._f)) {
            to._f = from._f;
        }
        if (!isUndefined(from._l)) {
            to._l = from._l;
        }
        if (!isUndefined(from._strict)) {
            to._strict = from._strict;
        }
        if (!isUndefined(from._tzm)) {
            to._tzm = from._tzm;
        }
        if (!isUndefined(from._isUTC)) {
            to._isUTC = from._isUTC;
        }
        if (!isUndefined(from._offset)) {
            to._offset = from._offset;
        }
        if (!isUndefined(from._pf)) {
            to._pf = getParsingFlags(from);
        }
        if (!isUndefined(from._locale)) {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i = 0; i < momentProperties.length; i++) {
                prop = momentProperties[i];
                val = from[prop];
                if (!isUndefined(val)) {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        if (!this.isValid()) {
            this._d = new Date(NaN);
        }
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            // -0 -> 0
            return Math.ceil(number) || 0;
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function warn(msg) {
        if (hooks.suppressDeprecationWarnings === false &&
                (typeof console !==  'undefined') && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (hooks.deprecationHandler != null) {
                hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
                var args = [];
                var arg;
                for (var i = 0; i < arguments.length; i++) {
                    arg = '';
                    if (typeof arguments[i] === 'object') {
                        arg += '\n[' + i + '] ';
                        for (var key in arguments[0]) {
                            arg += key + ': ' + arguments[0][key] + ', ';
                        }
                        arg = arg.slice(0, -2); // Remove trailing comma and space
                    } else {
                        arg = arguments[i];
                    }
                    args.push(arg);
                }
                warn(msg + '\nArguments: ' + Array.prototype.slice.call(args).join('') + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(name, msg);
        }
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    hooks.suppressDeprecationWarnings = false;
    hooks.deprecationHandler = null;

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }

    function set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (isFunction(prop)) {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        this._config = config;
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
        // TODO: Remove "ordinalParse" fallback in next major release.
        this._dayOfMonthOrdinalParseLenient = new RegExp(
            (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
                '|' + (/\d{1,2}/).source);
    }

    function mergeConfigs(parentConfig, childConfig) {
        var res = extend({}, parentConfig), prop;
        for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
                if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                    res[prop] = {};
                    extend(res[prop], parentConfig[prop]);
                    extend(res[prop], childConfig[prop]);
                } else if (childConfig[prop] != null) {
                    res[prop] = childConfig[prop];
                } else {
                    delete res[prop];
                }
            }
        }
        for (prop in parentConfig) {
            if (hasOwnProp(parentConfig, prop) &&
                    !hasOwnProp(childConfig, prop) &&
                    isObject(parentConfig[prop])) {
                // make sure changes to properties don't modify parent config
                res[prop] = extend({}, res[prop]);
            }
        }
        return res;
    }

    function Locale(config) {
        if (config != null) {
            this.set(config);
        }
    }

    var keys;

    if (Object.keys) {
        keys = Object.keys;
    } else {
        keys = function (obj) {
            var i, res = [];
            for (i in obj) {
                if (hasOwnProp(obj, i)) {
                    res.push(i);
                }
            }
            return res;
        };
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function calendar (key, mom, now) {
        var output = this._calendar[key] || this._calendar['sameElse'];
        return isFunction(output) ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultDayOfMonthOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        ss : '%d seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (isFunction(output)) ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return isFunction(format) ? format(output) : format.replace(/%s/i, output);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    var priorities = {};

    function addUnitPriority(unit, priority) {
        priorities[unit] = priority;
    }

    function getPrioritizedUnits(unitsObj) {
        var units = [];
        for (var u in unitsObj) {
            units.push({unit: u, priority: priorities[u]});
        }
        units.sort(function (a, b) {
            return a.priority - b.priority;
        });
        return units;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '', i;
            for (i = 0; i < length; i++) {
                output += isFunction(array[i]) ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match3to4      = /\d\d\d\d?/;     //     999 - 9999
    var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
    var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    // includes scottish gaelic two word and hyphenated months
    var matchWord = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i;

    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }));
    }

    function regexEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (isNumber(callback)) {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;
    var WEEK = 7;
    var WEEKDAY = 8;

    // FORMATTING

    addFormatToken('Y', 0, 0, function () {
        var y = this.year();
        return y <= 9999 ? '' + y : '+' + y;
    });

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PRIORITIES

    addUnitPriority('year', 1);

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = hooks.parseTwoDigitYear(input);
    });
    addParseToken('Y', function (input, array) {
        array[YEAR] = parseInt(input, 10);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', true);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                set$1(this, unit, value);
                hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get(this, unit);
            }
        };
    }

    function get (mom, unit) {
        return mom.isValid() ?
            mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
    }

    function set$1 (mom, unit, value) {
        if (mom.isValid() && !isNaN(value)) {
            if (unit === 'FullYear' && isLeapYear(mom.year()) && mom.month() === 1 && mom.date() === 29) {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value, mom.month(), daysInMonth(value, mom.month()));
            }
            else {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
            }
        }
    }

    // MOMENTS

    function stringGet (units) {
        units = normalizeUnits(units);
        if (isFunction(this[units])) {
            return this[units]();
        }
        return this;
    }


    function stringSet (units, value) {
        if (typeof units === 'object') {
            units = normalizeObjectUnits(units);
            var prioritized = getPrioritizedUnits(units);
            for (var i = 0; i < prioritized.length; i++) {
                this[prioritized[i].unit](units[prioritized[i].unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units](value);
            }
        }
        return this;
    }

    function mod(n, x) {
        return ((n % x) + x) % x;
    }

    var indexOf;

    if (Array.prototype.indexOf) {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (o) {
            // I know
            var i;
            for (i = 0; i < this.length; ++i) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }

    function daysInMonth(year, month) {
        if (isNaN(year) || isNaN(month)) {
            return NaN;
        }
        var modMonth = mod(month, 12);
        year += (month - modMonth) / 12;
        return modMonth === 1 ? (isLeapYear(year) ? 29 : 28) : (31 - modMonth % 7 % 2);
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PRIORITY

    addUnitPriority('month', 8);

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  function (isStrict, locale) {
        return locale.monthsShortRegex(isStrict);
    });
    addRegexToken('MMMM', function (isStrict, locale) {
        return locale.monthsRegex(isStrict);
    });

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/;
    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m, format) {
        if (!m) {
            return isArray(this._months) ? this._months :
                this._months['standalone'];
        }
        return isArray(this._months) ? this._months[m.month()] :
            this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format) ? 'format' : 'standalone'][m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m, format) {
        if (!m) {
            return isArray(this._monthsShort) ? this._monthsShort :
                this._monthsShort['standalone'];
        }
        return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
            this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    function handleStrictParse(monthName, format, strict) {
        var i, ii, mom, llc = monthName.toLocaleLowerCase();
        if (!this._monthsParse) {
            // this is not used
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
                mom = createUTC([2000, i]);
                this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (this._monthsParseExact) {
            return handleStrictParse.call(this, monthName, format, strict);
        }

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        // TODO: add sorting
        // Sorting makes sure if one month (or abbr) is a prefix of another
        // see sorting in computeMonthsParse
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        if (!mom.isValid()) {
            // No op
            return mom;
        }

        if (typeof value === 'string') {
            if (/^\d+$/.test(value)) {
                value = toInt(value);
            } else {
                value = mom.localeData().monthsParse(value);
                // TODO: Another silent failure?
                if (!isNumber(value)) {
                    return mom;
                }
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            hooks.updateOffset(this, true);
            return this;
        } else {
            return get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    var defaultMonthsShortRegex = matchWord;
    function monthsShortRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsShortStrictRegex;
            } else {
                return this._monthsShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsShortRegex')) {
                this._monthsShortRegex = defaultMonthsShortRegex;
            }
            return this._monthsShortStrictRegex && isStrict ?
                this._monthsShortStrictRegex : this._monthsShortRegex;
        }
    }

    var defaultMonthsRegex = matchWord;
    function monthsRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsStrictRegex;
            } else {
                return this._monthsRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsRegex')) {
                this._monthsRegex = defaultMonthsRegex;
            }
            return this._monthsStrictRegex && isStrict ?
                this._monthsStrictRegex : this._monthsRegex;
        }
    }

    function computeMonthsParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom;
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            shortPieces.push(this.monthsShort(mom, ''));
            longPieces.push(this.months(mom, ''));
            mixedPieces.push(this.months(mom, ''));
            mixedPieces.push(this.monthsShort(mom, ''));
        }
        // Sorting makes sure if one month (or abbr) is a prefix of another it
        // will match the longer piece.
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 12; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
        }
        for (i = 0; i < 24; i++) {
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._monthsShortRegex = this._monthsRegex;
        this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    }

    function createDate (y, m, d, h, M, s, ms) {
        // can't just apply() to create a date:
        // https://stackoverflow.com/q/181348
        var date;
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            date = new Date(y + 400, m, d, h, M, s, ms);
            if (isFinite(date.getFullYear())) {
                date.setFullYear(y);
            }
        } else {
            date = new Date(y, m, d, h, M, s, ms);
        }

        return date;
    }

    function createUTCDate (y) {
        var date;
        // the Date.UTC function remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            var args = Array.prototype.slice.call(arguments);
            // preserve leap years using a full 400 year cycle, then reset
            args[0] = y + 400;
            date = new Date(Date.UTC.apply(null, args));
            if (isFinite(date.getUTCFullYear())) {
                date.setUTCFullYear(y);
            }
        } else {
            date = new Date(Date.UTC.apply(null, arguments));
        }

        return date;
    }

    // start-of-first-week - start-of-year
    function firstWeekOffset(year, dow, doy) {
        var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
            fwd = 7 + dow - doy,
            // first-week day local weekday -- which local weekday is fwd
            fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

        return -fwdlw + fwd - 1;
    }

    // https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
        var localWeekday = (7 + weekday - dow) % 7,
            weekOffset = firstWeekOffset(year, dow, doy),
            dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
            resYear, resDayOfYear;

        if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
        } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
        } else {
            resYear = year;
            resDayOfYear = dayOfYear;
        }

        return {
            year: resYear,
            dayOfYear: resDayOfYear
        };
    }

    function weekOfYear(mom, dow, doy) {
        var weekOffset = firstWeekOffset(mom.year(), dow, doy),
            week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
            resWeek, resYear;

        if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
        } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
        } else {
            resYear = mom.year();
            resWeek = week;
        }

        return {
            week: resWeek,
            year: resYear
        };
    }

    function weeksInYear(year, dow, doy) {
        var weekOffset = firstWeekOffset(year, dow, doy),
            weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
        return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
    }

    // FORMATTING

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PRIORITIES

    addUnitPriority('week', 5);
    addUnitPriority('isoWeek', 5);

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 6th is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    // FORMATTING

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PRIORITY
    addUnitPriority('day', 11);
    addUnitPriority('weekday', 11);
    addUnitPriority('isoWeekday', 11);

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   function (isStrict, locale) {
        return locale.weekdaysMinRegex(isStrict);
    });
    addRegexToken('ddd',   function (isStrict, locale) {
        return locale.weekdaysShortRegex(isStrict);
    });
    addRegexToken('dddd',   function (isStrict, locale) {
        return locale.weekdaysRegex(isStrict);
    });

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
        var weekday = config._locale.weekdaysParse(input, token, config._strict);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    function parseIsoWeekday(input, locale) {
        if (typeof input === 'string') {
            return locale.weekdaysParse(input) % 7 || 7;
        }
        return isNaN(input) ? null : input;
    }

    // LOCALES
    function shiftWeekdays (ws, n) {
        return ws.slice(n, 7).concat(ws.slice(0, n));
    }

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m, format) {
        var weekdays = isArray(this._weekdays) ? this._weekdays :
            this._weekdays[(m && m !== true && this._weekdays.isFormat.test(format)) ? 'format' : 'standalone'];
        return (m === true) ? shiftWeekdays(weekdays, this._week.dow)
            : (m) ? weekdays[m.day()] : weekdays;
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysShort, this._week.dow)
            : (m) ? this._weekdaysShort[m.day()] : this._weekdaysShort;
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysMin, this._week.dow)
            : (m) ? this._weekdaysMin[m.day()] : this._weekdaysMin;
    }

    function handleStrictParse$1(weekdayName, format, strict) {
        var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];

            for (i = 0; i < 7; ++i) {
                mom = createUTC([2000, 1]).day(i);
                this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeWeekdaysParse (weekdayName, format, strict) {
        var i, mom, regex;

        if (this._weekdaysParseExact) {
            return handleStrictParse$1.call(this, weekdayName, format, strict);
        }

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already

            mom = createUTC([2000, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
                this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\\.?') + '$', 'i');
                this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\\.?') + '$', 'i');
                this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\\.?') + '$', 'i');
            }
            if (!this._weekdaysParse[i]) {
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }

        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.

        if (input != null) {
            var weekday = parseIsoWeekday(input, this.localeData());
            return this.day(this.day() % 7 ? weekday : weekday - 7);
        } else {
            return this.day() || 7;
        }
    }

    var defaultWeekdaysRegex = matchWord;
    function weekdaysRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysStrictRegex;
            } else {
                return this._weekdaysRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                this._weekdaysRegex = defaultWeekdaysRegex;
            }
            return this._weekdaysStrictRegex && isStrict ?
                this._weekdaysStrictRegex : this._weekdaysRegex;
        }
    }

    var defaultWeekdaysShortRegex = matchWord;
    function weekdaysShortRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysShortStrictRegex;
            } else {
                return this._weekdaysShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysShortRegex')) {
                this._weekdaysShortRegex = defaultWeekdaysShortRegex;
            }
            return this._weekdaysShortStrictRegex && isStrict ?
                this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
        }
    }

    var defaultWeekdaysMinRegex = matchWord;
    function weekdaysMinRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysMinStrictRegex;
            } else {
                return this._weekdaysMinRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysMinRegex')) {
                this._weekdaysMinRegex = defaultWeekdaysMinRegex;
            }
            return this._weekdaysMinStrictRegex && isStrict ?
                this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
        }
    }


    function computeWeekdaysParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom, minp, shortp, longp;
        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, 1]).day(i);
            minp = this.weekdaysMin(mom, '');
            shortp = this.weekdaysShort(mom, '');
            longp = this.weekdays(mom, '');
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
        }
        // Sorting makes sure if one weekday (or abbr) is a prefix of another it
        // will match the longer piece.
        minPieces.sort(cmpLenRev);
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 7; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._weekdaysShortRegex = this._weekdaysRegex;
        this._weekdaysMinRegex = this._weekdaysRegex;

        this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
        this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
    }

    // FORMATTING

    function hFormat() {
        return this.hours() % 12 || 12;
    }

    function kFormat() {
        return this.hours() || 24;
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, hFormat);
    addFormatToken('k', ['kk', 2], 0, kFormat);

    addFormatToken('hmm', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
    });

    addFormatToken('hmmss', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    addFormatToken('Hmm', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2);
    });

    addFormatToken('Hmmss', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PRIORITY
    addUnitPriority('hour', 13);

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('k',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);
    addRegexToken('kk', match1to2, match2);

    addRegexToken('hmm', match3to4);
    addRegexToken('hmmss', match5to6);
    addRegexToken('Hmm', match3to4);
    addRegexToken('Hmmss', match5to6);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['k', 'kk'], function (input, array, config) {
        var kInput = toInt(input);
        array[HOUR] = kInput === 24 ? 0 : kInput;
    });
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('Hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
    });
    addParseToken('Hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour they want. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    var baseConfig = {
        calendar: defaultCalendar,
        longDateFormat: defaultLongDateFormat,
        invalidDate: defaultInvalidDate,
        ordinal: defaultOrdinal,
        dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
        relativeTime: defaultRelativeTime,

        months: defaultLocaleMonths,
        monthsShort: defaultLocaleMonthsShort,

        week: defaultLocaleWeek,

        weekdays: defaultLocaleWeekdays,
        weekdaysMin: defaultLocaleWeekdaysMin,
        weekdaysShort: defaultLocaleWeekdaysShort,

        meridiemParse: defaultLocaleMeridiemParse
    };

    // internal storage for locale config files
    var locales = {};
    var localeFamilies = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return globalLocale;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && (typeof module !== 'undefined') &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                var aliasedRequire = require;
                aliasedRequire('./locale/' + name);
                getSetGlobalLocale(oldLocale);
            } catch (e) {}
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (isUndefined(values)) {
                data = getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
            else {
                if ((typeof console !==  'undefined') && console.warn) {
                    //warn user if arguments are passed but the locale could not be set
                    console.warn('Locale ' + key +  ' not found. Did you forget to load it?');
                }
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, config) {
        if (config !== null) {
            var locale, parentConfig = baseConfig;
            config.abbr = name;
            if (locales[name] != null) {
                deprecateSimple('defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                        'an existing locale. moment.defineLocale(localeName, ' +
                        'config) should only be used for creating a new locale ' +
                        'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.');
                parentConfig = locales[name]._config;
            } else if (config.parentLocale != null) {
                if (locales[config.parentLocale] != null) {
                    parentConfig = locales[config.parentLocale]._config;
                } else {
                    locale = loadLocale(config.parentLocale);
                    if (locale != null) {
                        parentConfig = locale._config;
                    } else {
                        if (!localeFamilies[config.parentLocale]) {
                            localeFamilies[config.parentLocale] = [];
                        }
                        localeFamilies[config.parentLocale].push({
                            name: name,
                            config: config
                        });
                        return null;
                    }
                }
            }
            locales[name] = new Locale(mergeConfigs(parentConfig, config));

            if (localeFamilies[name]) {
                localeFamilies[name].forEach(function (x) {
                    defineLocale(x.name, x.config);
                });
            }

            // backwards compat for now: also set the locale
            // make sure we set the locale AFTER all child locales have been
            // created, so we won't end up with the child locale set.
            getSetGlobalLocale(name);


            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    function updateLocale(name, config) {
        if (config != null) {
            var locale, tmpLocale, parentConfig = baseConfig;
            // MERGE
            tmpLocale = loadLocale(name);
            if (tmpLocale != null) {
                parentConfig = tmpLocale._config;
            }
            config = mergeConfigs(parentConfig, config);
            locale = new Locale(config);
            locale.parentLocale = locales[name];
            locales[name] = locale;

            // backwards compat for now: also set the locale
            getSetGlobalLocale(name);
        } else {
            // pass null for config to unupdate, useful for tests
            if (locales[name] != null) {
                if (locales[name].parentLocale != null) {
                    locales[name] = locales[name].parentLocale;
                } else if (locales[name] != null) {
                    delete locales[name];
                }
            }
        }
        return locales[name];
    }

    // returns locale data
    function getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    function listLocales() {
        return keys(locales);
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                overflow = WEEKDAY;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        // hooks is actually the exported moment object
        var nowValue = new Date(hooks.now());
        if (config._useUTC) {
            return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
        }
        return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, expectedWeekday, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear != null) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        expectedWeekday = config._useUTC ? config._d.getUTCDay() : config._d.getDay();

        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }

        // check for mismatching day of week
        if (config._w && typeof config._w.d !== 'undefined' && config._w.d !== expectedWeekday) {
            getParsingFlags(config).weekdayMismatch = true;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
                weekdayOverflow = true;
            }
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            var curWeek = weekOfYear(createLocal(), dow, doy);

            weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

            // Default to current week.
            week = defaults(w.w, curWeek.week);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < 0 || weekday > 6) {
                    weekdayOverflow = true;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from beginning of week
                weekday = w.e + dow;
                if (w.e < 0 || w.e > 6) {
                    weekdayOverflow = true;
                }
            } else {
                // default to beginning of week
                weekday = dow;
            }
        }
        if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
        } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
        } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
        }
    }

    // iso 8601 regex
    // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
    var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
    var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

    var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
        ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
        ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
        ['YYYY-DDD', /\d{4}-\d{3}/],
        ['YYYY-MM', /\d{4}-\d\d/, false],
        ['YYYYYYMMDD', /[+-]\d{10}/],
        ['YYYYMMDD', /\d{8}/],
        // YYYYMM is NOT allowed by the standard
        ['GGGG[W]WWE', /\d{4}W\d{3}/],
        ['GGGG[W]WW', /\d{4}W\d{2}/, false],
        ['YYYYDDD', /\d{7}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
        ['HH:mm:ss', /\d\d:\d\d:\d\d/],
        ['HH:mm', /\d\d:\d\d/],
        ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
        ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
        ['HHmmss', /\d\d\d\d\d\d/],
        ['HHmm', /\d\d\d\d/],
        ['HH', /\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
            allowTime, dateFormat, timeFormat, tzFormat;

        if (match) {
            getParsingFlags(config).iso = true;

            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(match[1])) {
                    dateFormat = isoDates[i][0];
                    allowTime = isoDates[i][2] !== false;
                    break;
                }
            }
            if (dateFormat == null) {
                config._isValid = false;
                return;
            }
            if (match[3]) {
                for (i = 0, l = isoTimes.length; i < l; i++) {
                    if (isoTimes[i][1].exec(match[3])) {
                        // match[2] should be 'T' or space
                        timeFormat = (match[2] || ' ') + isoTimes[i][0];
                        break;
                    }
                }
                if (timeFormat == null) {
                    config._isValid = false;
                    return;
                }
            }
            if (!allowTime && timeFormat != null) {
                config._isValid = false;
                return;
            }
            if (match[4]) {
                if (tzRegex.exec(match[4])) {
                    tzFormat = 'Z';
                } else {
                    config._isValid = false;
                    return;
                }
            }
            config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
    var rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/;

    function extractFromRFC2822Strings(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
        var result = [
            untruncateYear(yearStr),
            defaultLocaleMonthsShort.indexOf(monthStr),
            parseInt(dayStr, 10),
            parseInt(hourStr, 10),
            parseInt(minuteStr, 10)
        ];

        if (secondStr) {
            result.push(parseInt(secondStr, 10));
        }

        return result;
    }

    function untruncateYear(yearStr) {
        var year = parseInt(yearStr, 10);
        if (year <= 49) {
            return 2000 + year;
        } else if (year <= 999) {
            return 1900 + year;
        }
        return year;
    }

    function preprocessRFC2822(s) {
        // Remove comments and folding whitespace and replace multiple-spaces with a single space
        return s.replace(/\([^)]*\)|[\n\t]/g, ' ').replace(/(\s\s+)/g, ' ').replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }

    function checkWeekday(weekdayStr, parsedInput, config) {
        if (weekdayStr) {
            // TODO: Replace the vanilla JS Date object with an indepentent day-of-week check.
            var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr),
                weekdayActual = new Date(parsedInput[0], parsedInput[1], parsedInput[2]).getDay();
            if (weekdayProvided !== weekdayActual) {
                getParsingFlags(config).weekdayMismatch = true;
                config._isValid = false;
                return false;
            }
        }
        return true;
    }

    var obsOffsets = {
        UT: 0,
        GMT: 0,
        EDT: -4 * 60,
        EST: -5 * 60,
        CDT: -5 * 60,
        CST: -6 * 60,
        MDT: -6 * 60,
        MST: -7 * 60,
        PDT: -7 * 60,
        PST: -8 * 60
    };

    function calculateOffset(obsOffset, militaryOffset, numOffset) {
        if (obsOffset) {
            return obsOffsets[obsOffset];
        } else if (militaryOffset) {
            // the only allowed military tz is Z
            return 0;
        } else {
            var hm = parseInt(numOffset, 10);
            var m = hm % 100, h = (hm - m) / 100;
            return h * 60 + m;
        }
    }

    // date and time from ref 2822 format
    function configFromRFC2822(config) {
        var match = rfc2822.exec(preprocessRFC2822(config._i));
        if (match) {
            var parsedArray = extractFromRFC2822Strings(match[4], match[3], match[2], match[5], match[6], match[7]);
            if (!checkWeekday(match[1], parsedArray, config)) {
                return;
            }

            config._a = parsedArray;
            config._tzm = calculateOffset(match[8], match[9], match[10]);

            config._d = createUTCDate.apply(null, config._a);
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);

            getParsingFlags(config).rfc2822 = true;
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        configFromRFC2822(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        // Final attempt, use Input Fallback
        hooks.createFromInputFallback(config);
    }

    hooks.createFromInputFallback = deprecate(
        'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
        'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
        'discouraged and will be removed in an upcoming major release. Please refer to ' +
        'http://momentjs.com/guides/#/warnings/js-date/ for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    // constant that refers to the ISO standard
    hooks.ISO_8601 = function () {};

    // constant that refers to the RFC 2822 form
    hooks.RFC_2822 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === hooks.ISO_8601) {
            configFromISO(config);
            return;
        }
        if (config._f === hooks.RFC_2822) {
            configFromRFC2822(config);
            return;
        }
        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            // console.log('token', token, 'parsedInput', parsedInput,
            //         'regex', getParseRegexForToken(token, config));
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._a[HOUR] <= 12 &&
            getParsingFlags(config).bigHour === true &&
            config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }

        getParsingFlags(config).parsedDateParts = config._a.slice(0);
        getParsingFlags(config).meridiem = config._meridiem;
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    // date from string and array of format strings
    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
            return obj && parseInt(obj, 10);
        });

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isDate(input)) {
            config._d = input;
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        }  else {
            configFromInput(config);
        }

        if (!isValid(config)) {
            config._d = null;
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (isUndefined(input)) {
            config._d = new Date(hooks.now());
        } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (isObject(input)) {
            configFromObject(config);
        } else if (isNumber(input)) {
            // from milliseconds
            config._d = new Date(input);
        } else {
            hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (locale === true || locale === false) {
            strict = locale;
            locale = undefined;
        }

        if ((isObject(input) && isObjectEmpty(input)) ||
                (isArray(input) && input.length === 0)) {
            input = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
        'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other < this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other > this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    var now = function () {
        return Date.now ? Date.now() : +(new Date());
    };

    var ordering = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

    function isDurationValid(m) {
        for (var key in m) {
            if (!(indexOf.call(ordering, key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
                return false;
            }
        }

        var unitHasDecimal = false;
        for (var i = 0; i < ordering.length; ++i) {
            if (m[ordering[i]]) {
                if (unitHasDecimal) {
                    return false; // only allow non-integers for smallest unit
                }
                if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                    unitHasDecimal = true;
                }
            }
        }

        return true;
    }

    function isValid$1() {
        return this._isValid;
    }

    function createInvalid$1() {
        return createDuration(NaN);
    }

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || normalizedInput.isoWeek || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        this._isValid = isDurationValid(normalizedInput);

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible to translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    function absRound (number) {
        if (number < 0) {
            return Math.round(-1 * number) * -1;
        } else {
            return Math.round(number);
        }
    }

    // FORMATTING

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchShortOffset);
    addRegexToken('ZZ', matchShortOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(matchShortOffset, input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(matcher, string) {
        var matches = (string || '').match(matcher);

        if (matches === null) {
            return null;
        }

        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return minutes === 0 ?
          0 :
          parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(res._d.valueOf() + diff);
            hooks.updateOffset(res, false);
            return res;
        } else {
            return createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime, keepMinutes) {
        var offset = this._offset || 0,
            localAdjust;
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(matchShortOffset, input);
                if (input === null) {
                    return this;
                }
            } else if (Math.abs(input) < 16 && !keepMinutes) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    addSubtract(this, createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm != null) {
            this.utcOffset(this._tzm, false, true);
        } else if (typeof this._i === 'string') {
            var tZone = offsetFromString(matchOffset, this._i);
            if (tZone != null) {
                this.utcOffset(tZone);
            }
            else {
                this.utcOffset(0, true);
            }
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!this.isValid()) {
            return false;
        }
        input = input ? createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return this.isValid() ? !this._isUTC : false;
    }

    function isUtcOffset () {
        return this.isValid() ? this._isUTC : false;
    }

    function isUtc () {
        return this.isValid() ? this._isUTC && this._offset === 0 : false;
    }

    // ASP.NET json date format regex
    var aspNetRegex = /^(\-|\+)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)(\.\d*)?)?$/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    // and further modified to allow for strings containing both week and day
    var isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;

    function createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (isNumber(input)) {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])                         * sign,
                h  : toInt(match[HOUR])                         * sign,
                m  : toInt(match[MINUTE])                       * sign,
                s  : toInt(match[SECOND])                       * sign,
                ms : toInt(absRound(match[MILLISECOND] * 1000)) * sign // the millisecond decimal point is included in the match
            };
        } else if (!!(match = isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                w : parseIso(match[4], sign),
                d : parseIso(match[5], sign),
                h : parseIso(match[6], sign),
                m : parseIso(match[7], sign),
                s : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(createLocal(duration.from), createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    createDuration.fn = Duration.prototype;
    createDuration.invalid = createInvalid$1;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        if (!(base.isValid() && other.isValid())) {
            return {milliseconds: 0, months: 0};
        }

        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period). ' +
                'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = createDuration(val, period);
            addSubtract(this, dur, direction);
            return this;
        };
    }

    function addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = absRound(duration._days),
            months = absRound(duration._months);

        if (!mom.isValid()) {
            // No op
            return;
        }

        updateOffset = updateOffset == null ? true : updateOffset;

        if (months) {
            setMonth(mom, get(mom, 'Month') + months * isAdding);
        }
        if (days) {
            set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
        }
        if (milliseconds) {
            mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
        }
        if (updateOffset) {
            hooks.updateOffset(mom, days || months);
        }
    }

    var add      = createAdder(1, 'add');
    var subtract = createAdder(-1, 'subtract');

    function getCalendarFormat(myMoment, now) {
        var diff = myMoment.diff(now, 'days', true);
        return diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
    }

    function calendar$1 (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            format = hooks.calendarFormat(this, sod) || 'sameElse';

        var output = formats && (isFunction(formats[format]) ? formats[format].call(this, now) : formats[format]);

        return this.format(output || this.localeData().calendar(format, this, createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() > localInput.valueOf();
        } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
        }
    }

    function isBefore (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() < localInput.valueOf();
        } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
        }
    }

    function isBetween (from, to, units, inclusivity) {
        var localFrom = isMoment(from) ? from : createLocal(from),
            localTo = isMoment(to) ? to : createLocal(to);
        if (!(this.isValid() && localFrom.isValid() && localTo.isValid())) {
            return false;
        }
        inclusivity = inclusivity || '()';
        return (inclusivity[0] === '(' ? this.isAfter(localFrom, units) : !this.isBefore(localFrom, units)) &&
            (inclusivity[1] === ')' ? this.isBefore(localTo, units) : !this.isAfter(localTo, units));
    }

    function isSame (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input),
            inputMs;
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() === localInput.valueOf();
        } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
        }
    }

    function isSameOrAfter (input, units) {
        return this.isSame(input, units) || this.isAfter(input, units);
    }

    function isSameOrBefore (input, units) {
        return this.isSame(input, units) || this.isBefore(input, units);
    }

    function diff (input, units, asFloat) {
        var that,
            zoneDelta,
            output;

        if (!this.isValid()) {
            return NaN;
        }

        that = cloneWithOffset(input, this);

        if (!that.isValid()) {
            return NaN;
        }

        zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

        units = normalizeUnits(units);

        switch (units) {
            case 'year': output = monthDiff(this, that) / 12; break;
            case 'month': output = monthDiff(this, that); break;
            case 'quarter': output = monthDiff(this, that) / 3; break;
            case 'second': output = (this - that) / 1e3; break; // 1000
            case 'minute': output = (this - that) / 6e4; break; // 1000 * 60
            case 'hour': output = (this - that) / 36e5; break; // 1000 * 60 * 60
            case 'day': output = (this - that - zoneDelta) / 864e5; break; // 1000 * 60 * 60 * 24, negate dst
            case 'week': output = (this - that - zoneDelta) / 6048e5; break; // 1000 * 60 * 60 * 24 * 7, negate dst
            default: output = this - that;
        }

        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }

    hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function toISOString(keepOffset) {
        if (!this.isValid()) {
            return null;
        }
        var utc = keepOffset !== true;
        var m = utc ? this.clone().utc() : this;
        if (m.year() < 0 || m.year() > 9999) {
            return formatMoment(m, utc ? 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYYYY-MM-DD[T]HH:mm:ss.SSSZ');
        }
        if (isFunction(Date.prototype.toISOString)) {
            // native implementation is ~50x faster, use it when we can
            if (utc) {
                return this.toDate().toISOString();
            } else {
                return new Date(this.valueOf() + this.utcOffset() * 60 * 1000).toISOString().replace('Z', formatMoment(m, 'Z'));
            }
        }
        return formatMoment(m, utc ? 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYY-MM-DD[T]HH:mm:ss.SSSZ');
    }

    /**
     * Return a human readable representation of a moment that can
     * also be evaluated to get a new moment which is the same
     *
     * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
     */
    function inspect () {
        if (!this.isValid()) {
            return 'moment.invalid(/* ' + this._i + ' */)';
        }
        var func = 'moment';
        var zone = '';
        if (!this.isLocal()) {
            func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
            zone = 'Z';
        }
        var prefix = '[' + func + '("]';
        var year = (0 <= this.year() && this.year() <= 9999) ? 'YYYY' : 'YYYYYY';
        var datetime = '-MM-DD[T]HH:mm:ss.SSS';
        var suffix = zone + '[")]';

        return this.format(prefix + year + datetime + suffix);
    }

    function format (inputString) {
        if (!inputString) {
            inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
        }
        var output = formatMoment(this, inputString);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function fromNow (withoutSuffix) {
        return this.from(createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function toNow (withoutSuffix) {
        return this.to(createLocal(), withoutSuffix);
    }

    // If passed a locale key, it will set the locale for this
    // instance.  Otherwise, it will return the locale configuration
    // variables for this instance.
    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    var MS_PER_SECOND = 1000;
    var MS_PER_MINUTE = 60 * MS_PER_SECOND;
    var MS_PER_HOUR = 60 * MS_PER_MINUTE;
    var MS_PER_400_YEARS = (365 * 400 + 97) * 24 * MS_PER_HOUR;

    // actual modulo - handles negative numbers (for dates before 1970):
    function mod$1(dividend, divisor) {
        return (dividend % divisor + divisor) % divisor;
    }

    function localStartOfDate(y, m, d) {
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return new Date(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return new Date(y, m, d).valueOf();
        }
    }

    function utcStartOfDate(y, m, d) {
        // Date.UTC remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return Date.UTC(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return Date.UTC(y, m, d);
        }
    }

    function startOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year(), 0, 1);
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3, 1);
                break;
            case 'month':
                time = startOfDate(this.year(), this.month(), 1);
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday());
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1));
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date());
                break;
            case 'hour':
                time = this._d.valueOf();
                time -= mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR);
                break;
            case 'minute':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_MINUTE);
                break;
            case 'second':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_SECOND);
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function endOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year() + 1, 0, 1) - 1;
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3 + 3, 1) - 1;
                break;
            case 'month':
                time = startOfDate(this.year(), this.month() + 1, 1) - 1;
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday() + 7) - 1;
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1) + 7) - 1;
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date() + 1) - 1;
                break;
            case 'hour':
                time = this._d.valueOf();
                time += MS_PER_HOUR - mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR) - 1;
                break;
            case 'minute':
                time = this._d.valueOf();
                time += MS_PER_MINUTE - mod$1(time, MS_PER_MINUTE) - 1;
                break;
            case 'second':
                time = this._d.valueOf();
                time += MS_PER_SECOND - mod$1(time, MS_PER_SECOND) - 1;
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function valueOf () {
        return this._d.valueOf() - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(this.valueOf() / 1000);
    }

    function toDate () {
        return new Date(this.valueOf());
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function toJSON () {
        // new Date(NaN).toJSON() === null
        return this.isValid() ? this.toISOString() : null;
    }

    function isValid$2 () {
        return isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    function creationData() {
        return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
        };
    }

    // FORMATTING

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PRIORITY

    addUnitPriority('weekYear', 1);
    addUnitPriority('isoWeekYear', 1);


    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = hooks.parseTwoDigitYear(input);
    });

    // MOMENTS

    function getSetWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy);
    }

    function getSetISOWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input, this.isoWeek(), this.isoWeekday(), 1, 4);
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    function getSetWeekYearHelper(input, week, weekday, dow, doy) {
        var weeksTarget;
        if (input == null) {
            return weekOfYear(this, dow, doy).year;
        } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
                week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
        }
    }

    function setWeekAll(weekYear, week, weekday, dow, doy) {
        var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
            date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

        this.year(date.getUTCFullYear());
        this.month(date.getUTCMonth());
        this.date(date.getUTCDate());
        return this;
    }

    // FORMATTING

    addFormatToken('Q', 0, 'Qo', 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PRIORITY

    addUnitPriority('quarter', 7);

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    // FORMATTING

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PRIORITY
    addUnitPriority('date', 9);

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        // TODO: Remove "ordinalParse" fallback in next major release.
        return isStrict ?
          (locale._dayOfMonthOrdinalParse || locale._ordinalParse) :
          locale._dayOfMonthOrdinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0]);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    // FORMATTING

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PRIORITY
    addUnitPriority('dayOfYear', 4);

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // FORMATTING

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PRIORITY

    addUnitPriority('minute', 14);

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    // FORMATTING

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PRIORITY

    addUnitPriority('second', 15);

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    // FORMATTING

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PRIORITY

    addUnitPriority('millisecond', 16);

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    // FORMATTING

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var proto = Moment.prototype;

    proto.add               = add;
    proto.calendar          = calendar$1;
    proto.clone             = clone;
    proto.diff              = diff;
    proto.endOf             = endOf;
    proto.format            = format;
    proto.from              = from;
    proto.fromNow           = fromNow;
    proto.to                = to;
    proto.toNow             = toNow;
    proto.get               = stringGet;
    proto.invalidAt         = invalidAt;
    proto.isAfter           = isAfter;
    proto.isBefore          = isBefore;
    proto.isBetween         = isBetween;
    proto.isSame            = isSame;
    proto.isSameOrAfter     = isSameOrAfter;
    proto.isSameOrBefore    = isSameOrBefore;
    proto.isValid           = isValid$2;
    proto.lang              = lang;
    proto.locale            = locale;
    proto.localeData        = localeData;
    proto.max               = prototypeMax;
    proto.min               = prototypeMin;
    proto.parsingFlags      = parsingFlags;
    proto.set               = stringSet;
    proto.startOf           = startOf;
    proto.subtract          = subtract;
    proto.toArray           = toArray;
    proto.toObject          = toObject;
    proto.toDate            = toDate;
    proto.toISOString       = toISOString;
    proto.inspect           = inspect;
    proto.toJSON            = toJSON;
    proto.toString          = toString;
    proto.unix              = unix;
    proto.valueOf           = valueOf;
    proto.creationData      = creationData;
    proto.year       = getSetYear;
    proto.isLeapYear = getIsLeapYear;
    proto.weekYear    = getSetWeekYear;
    proto.isoWeekYear = getSetISOWeekYear;
    proto.quarter = proto.quarters = getSetQuarter;
    proto.month       = getSetMonth;
    proto.daysInMonth = getDaysInMonth;
    proto.week           = proto.weeks        = getSetWeek;
    proto.isoWeek        = proto.isoWeeks     = getSetISOWeek;
    proto.weeksInYear    = getWeeksInYear;
    proto.isoWeeksInYear = getISOWeeksInYear;
    proto.date       = getSetDayOfMonth;
    proto.day        = proto.days             = getSetDayOfWeek;
    proto.weekday    = getSetLocaleDayOfWeek;
    proto.isoWeekday = getSetISODayOfWeek;
    proto.dayOfYear  = getSetDayOfYear;
    proto.hour = proto.hours = getSetHour;
    proto.minute = proto.minutes = getSetMinute;
    proto.second = proto.seconds = getSetSecond;
    proto.millisecond = proto.milliseconds = getSetMillisecond;
    proto.utcOffset            = getSetOffset;
    proto.utc                  = setOffsetToUTC;
    proto.local                = setOffsetToLocal;
    proto.parseZone            = setOffsetToParsedOffset;
    proto.hasAlignedHourOffset = hasAlignedHourOffset;
    proto.isDST                = isDaylightSavingTime;
    proto.isLocal              = isLocal;
    proto.isUtcOffset          = isUtcOffset;
    proto.isUtc                = isUtc;
    proto.isUTC                = isUtc;
    proto.zoneAbbr = getZoneAbbr;
    proto.zoneName = getZoneName;
    proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/', getSetZone);
    proto.isDSTShifted = deprecate('isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information', isDaylightSavingTimeShifted);

    function createUnix (input) {
        return createLocal(input * 1000);
    }

    function createInZone () {
        return createLocal.apply(null, arguments).parseZone();
    }

    function preParsePostFormat (string) {
        return string;
    }

    var proto$1 = Locale.prototype;

    proto$1.calendar        = calendar;
    proto$1.longDateFormat  = longDateFormat;
    proto$1.invalidDate     = invalidDate;
    proto$1.ordinal         = ordinal;
    proto$1.preparse        = preParsePostFormat;
    proto$1.postformat      = preParsePostFormat;
    proto$1.relativeTime    = relativeTime;
    proto$1.pastFuture      = pastFuture;
    proto$1.set             = set;

    proto$1.months            =        localeMonths;
    proto$1.monthsShort       =        localeMonthsShort;
    proto$1.monthsParse       =        localeMonthsParse;
    proto$1.monthsRegex       = monthsRegex;
    proto$1.monthsShortRegex  = monthsShortRegex;
    proto$1.week = localeWeek;
    proto$1.firstDayOfYear = localeFirstDayOfYear;
    proto$1.firstDayOfWeek = localeFirstDayOfWeek;

    proto$1.weekdays       =        localeWeekdays;
    proto$1.weekdaysMin    =        localeWeekdaysMin;
    proto$1.weekdaysShort  =        localeWeekdaysShort;
    proto$1.weekdaysParse  =        localeWeekdaysParse;

    proto$1.weekdaysRegex       =        weekdaysRegex;
    proto$1.weekdaysShortRegex  =        weekdaysShortRegex;
    proto$1.weekdaysMinRegex    =        weekdaysMinRegex;

    proto$1.isPM = localeIsPM;
    proto$1.meridiem = localeMeridiem;

    function get$1 (format, index, field, setter) {
        var locale = getLocale();
        var utc = createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function listMonthsImpl (format, index, field) {
        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return get$1(format, index, field, 'month');
        }

        var i;
        var out = [];
        for (i = 0; i < 12; i++) {
            out[i] = get$1(format, i, field, 'month');
        }
        return out;
    }

    // ()
    // (5)
    // (fmt, 5)
    // (fmt)
    // (true)
    // (true, 5)
    // (true, fmt, 5)
    // (true, fmt)
    function listWeekdaysImpl (localeSorted, format, index, field) {
        if (typeof localeSorted === 'boolean') {
            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        } else {
            format = localeSorted;
            index = format;
            localeSorted = false;

            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        }

        var locale = getLocale(),
            shift = localeSorted ? locale._week.dow : 0;

        if (index != null) {
            return get$1(format, (index + shift) % 7, field, 'day');
        }

        var i;
        var out = [];
        for (i = 0; i < 7; i++) {
            out[i] = get$1(format, (i + shift) % 7, field, 'day');
        }
        return out;
    }

    function listMonths (format, index) {
        return listMonthsImpl(format, index, 'months');
    }

    function listMonthsShort (format, index) {
        return listMonthsImpl(format, index, 'monthsShort');
    }

    function listWeekdays (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
    }

    function listWeekdaysShort (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
    }

    function listWeekdaysMin (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
    }

    getSetGlobalLocale('en', {
        dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports

    hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', getSetGlobalLocale);
    hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', getLocale);

    var mathAbs = Math.abs;

    function abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function addSubtract$1 (duration, input, value, direction) {
        var other = createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function add$1 (input, value) {
        return addSubtract$1(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function subtract$1 (input, value) {
        return addSubtract$1(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        if (!this.isValid()) {
            return NaN;
        }
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'quarter' || units === 'year') {
            days = this._days + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            switch (units) {
                case 'month':   return months;
                case 'quarter': return months / 3;
                case 'year':    return months / 12;
            }
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function valueOf$1 () {
        if (!this.isValid()) {
            return NaN;
        }
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asQuarters     = makeAs('Q');
    var asYears        = makeAs('y');

    function clone$1 () {
        return createDuration(this);
    }

    function get$2 (units) {
        units = normalizeUnits(units);
        return this.isValid() ? this[units + 's']() : NaN;
    }

    function makeGetter(name) {
        return function () {
            return this.isValid() ? this._data[name] : NaN;
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        ss: 44,         // a few seconds to seconds
        s : 45,         // seconds to minute
        m : 45,         // minutes to hour
        h : 22,         // hours to day
        d : 26,         // days to month
        M : 11          // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime$1 (posNegDuration, withoutSuffix, locale) {
        var duration = createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds <= thresholds.ss && ['s', seconds]  ||
                seconds < thresholds.s   && ['ss', seconds] ||
                minutes <= 1             && ['m']           ||
                minutes < thresholds.m   && ['mm', minutes] ||
                hours   <= 1             && ['h']           ||
                hours   < thresholds.h   && ['hh', hours]   ||
                days    <= 1             && ['d']           ||
                days    < thresholds.d   && ['dd', days]    ||
                months  <= 1             && ['M']           ||
                months  < thresholds.M   && ['MM', months]  ||
                years   <= 1             && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set the rounding function for relative time strings
    function getSetRelativeTimeRounding (roundingFunction) {
        if (roundingFunction === undefined) {
            return round;
        }
        if (typeof(roundingFunction) === 'function') {
            round = roundingFunction;
            return true;
        }
        return false;
    }

    // This function allows you to set a threshold for relative time strings
    function getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        if (threshold === 's') {
            thresholds.ss = limit - 1;
        }
        return true;
    }

    function humanize (withSuffix) {
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var locale = this.localeData();
        var output = relativeTime$1(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var abs$1 = Math.abs;

    function sign(x) {
        return ((x > 0) - (x < 0)) || +x;
    }

    function toISOString$1() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var seconds = abs$1(this._milliseconds) / 1000;
        var days         = abs$1(this._days);
        var months       = abs$1(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds ? seconds.toFixed(3).replace(/\.?0+$/, '') : '';
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        var totalSign = total < 0 ? '-' : '';
        var ymSign = sign(this._months) !== sign(total) ? '-' : '';
        var daysSign = sign(this._days) !== sign(total) ? '-' : '';
        var hmsSign = sign(this._milliseconds) !== sign(total) ? '-' : '';

        return totalSign + 'P' +
            (Y ? ymSign + Y + 'Y' : '') +
            (M ? ymSign + M + 'M' : '') +
            (D ? daysSign + D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? hmsSign + h + 'H' : '') +
            (m ? hmsSign + m + 'M' : '') +
            (s ? hmsSign + s + 'S' : '');
    }

    var proto$2 = Duration.prototype;

    proto$2.isValid        = isValid$1;
    proto$2.abs            = abs;
    proto$2.add            = add$1;
    proto$2.subtract       = subtract$1;
    proto$2.as             = as;
    proto$2.asMilliseconds = asMilliseconds;
    proto$2.asSeconds      = asSeconds;
    proto$2.asMinutes      = asMinutes;
    proto$2.asHours        = asHours;
    proto$2.asDays         = asDays;
    proto$2.asWeeks        = asWeeks;
    proto$2.asMonths       = asMonths;
    proto$2.asQuarters     = asQuarters;
    proto$2.asYears        = asYears;
    proto$2.valueOf        = valueOf$1;
    proto$2._bubble        = bubble;
    proto$2.clone          = clone$1;
    proto$2.get            = get$2;
    proto$2.milliseconds   = milliseconds;
    proto$2.seconds        = seconds;
    proto$2.minutes        = minutes;
    proto$2.hours          = hours;
    proto$2.days           = days;
    proto$2.weeks          = weeks;
    proto$2.months         = months;
    proto$2.years          = years;
    proto$2.humanize       = humanize;
    proto$2.toISOString    = toISOString$1;
    proto$2.toString       = toISOString$1;
    proto$2.toJSON         = toISOString$1;
    proto$2.locale         = locale;
    proto$2.localeData     = localeData;

    proto$2.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', toISOString$1);
    proto$2.lang = lang;

    // Side effect imports

    // FORMATTING

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    hooks.version = '2.24.0';

    setHookCallback(createLocal);

    hooks.fn                    = proto;
    hooks.min                   = min;
    hooks.max                   = max;
    hooks.now                   = now;
    hooks.utc                   = createUTC;
    hooks.unix                  = createUnix;
    hooks.months                = listMonths;
    hooks.isDate                = isDate;
    hooks.locale                = getSetGlobalLocale;
    hooks.invalid               = createInvalid;
    hooks.duration              = createDuration;
    hooks.isMoment              = isMoment;
    hooks.weekdays              = listWeekdays;
    hooks.parseZone             = createInZone;
    hooks.localeData            = getLocale;
    hooks.isDuration            = isDuration;
    hooks.monthsShort           = listMonthsShort;
    hooks.weekdaysMin           = listWeekdaysMin;
    hooks.defineLocale          = defineLocale;
    hooks.updateLocale          = updateLocale;
    hooks.locales               = listLocales;
    hooks.weekdaysShort         = listWeekdaysShort;
    hooks.normalizeUnits        = normalizeUnits;
    hooks.relativeTimeRounding  = getSetRelativeTimeRounding;
    hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
    hooks.calendarFormat        = getCalendarFormat;
    hooks.prototype             = proto;

    // currently HTML5 input type only supports 24-hour formats
    hooks.HTML5_FMT = {
        DATETIME_LOCAL: 'YYYY-MM-DDTHH:mm',             // <input type="datetime-local" />
        DATETIME_LOCAL_SECONDS: 'YYYY-MM-DDTHH:mm:ss',  // <input type="datetime-local" step="1" />
        DATETIME_LOCAL_MS: 'YYYY-MM-DDTHH:mm:ss.SSS',   // <input type="datetime-local" step="0.001" />
        DATE: 'YYYY-MM-DD',                             // <input type="date" />
        TIME: 'HH:mm',                                  // <input type="time" />
        TIME_SECONDS: 'HH:mm:ss',                       // <input type="time" step="1" />
        TIME_MS: 'HH:mm:ss.SSS',                        // <input type="time" step="0.001" />
        WEEK: 'GGGG-[W]WW',                             // <input type="week" />
        MONTH: 'YYYY-MM'                                // <input type="month" />
    };

    return hooks;

})));
//! moment-timezone.js
//! version : 0.5.25
//! Copyright (c) JS Foundation and other contributors
//! license : MIT
//! github.com/moment/moment-timezone

(function (root, factory) {
	"use strict";

	/*global define*/
	if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('moment')); // Node
	} else if (typeof define === 'function' && define.amd) {
		define(['moment'], factory);                 // AMD
	} else {
		factory(root.moment);                        // Browser
	}
}(this, function (moment) {
	"use strict";

	// Do not load moment-timezone a second time.
	// if (moment.tz !== undefined) {
	// 	logError('Moment Timezone ' + moment.tz.version + ' was already loaded ' + (moment.tz.dataVersion ? 'with data from ' : 'without any data') + moment.tz.dataVersion);
	// 	return moment;
	// }

	var VERSION = "0.5.25",
		zones = {},
		links = {},
		names = {},
		guesses = {},
		cachedGuess;

	if (!moment || typeof moment.version !== 'string') {
		logError('Moment Timezone requires Moment.js. See https://momentjs.com/timezone/docs/#/use-it/browser/');
	}

	var momentVersion = moment.version.split('.'),
		major = +momentVersion[0],
		minor = +momentVersion[1];

	// Moment.js version check
	if (major < 2 || (major === 2 && minor < 6)) {
		logError('Moment Timezone requires Moment.js >= 2.6.0. You are using Moment.js ' + moment.version + '. See momentjs.com');
	}

	/************************************
		Unpacking
	************************************/

	function charCodeToInt(charCode) {
		if (charCode > 96) {
			return charCode - 87;
		} else if (charCode > 64) {
			return charCode - 29;
		}
		return charCode - 48;
	}

	function unpackBase60(string) {
		var i = 0,
			parts = string.split('.'),
			whole = parts[0],
			fractional = parts[1] || '',
			multiplier = 1,
			num,
			out = 0,
			sign = 1;

		// handle negative numbers
		if (string.charCodeAt(0) === 45) {
			i = 1;
			sign = -1;
		}

		// handle digits before the decimal
		for (i; i < whole.length; i++) {
			num = charCodeToInt(whole.charCodeAt(i));
			out = 60 * out + num;
		}

		// handle digits after the decimal
		for (i = 0; i < fractional.length; i++) {
			multiplier = multiplier / 60;
			num = charCodeToInt(fractional.charCodeAt(i));
			out += num * multiplier;
		}

		return out * sign;
	}

	function arrayToInt (array) {
		for (var i = 0; i < array.length; i++) {
			array[i] = unpackBase60(array[i]);
		}
	}

	function intToUntil (array, length) {
		for (var i = 0; i < length; i++) {
			array[i] = Math.round((array[i - 1] || 0) + (array[i] * 60000)); // minutes to milliseconds
		}

		array[length - 1] = Infinity;
	}

	function mapIndices (source, indices) {
		var out = [], i;

		for (i = 0; i < indices.length; i++) {
			out[i] = source[indices[i]];
		}

		return out;
	}

	function unpack (string) {
		var data = string.split('|'),
			offsets = data[2].split(' '),
			indices = data[3].split(''),
			untils  = data[4].split(' ');

		arrayToInt(offsets);
		arrayToInt(indices);
		arrayToInt(untils);

		intToUntil(untils, indices.length);

		return {
			name       : data[0],
			abbrs      : mapIndices(data[1].split(' '), indices),
			offsets    : mapIndices(offsets, indices),
			untils     : untils,
			population : data[5] | 0
		};
	}

	/************************************
		Zone object
	************************************/

	function Zone (packedString) {
		if (packedString) {
			this._set(unpack(packedString));
		}
	}

	Zone.prototype = {
		_set : function (unpacked) {
			this.name       = unpacked.name;
			this.abbrs      = unpacked.abbrs;
			this.untils     = unpacked.untils;
			this.offsets    = unpacked.offsets;
			this.population = unpacked.population;
		},

		_index : function (timestamp) {
			var target = +timestamp,
				untils = this.untils,
				i;

			for (i = 0; i < untils.length; i++) {
				if (target < untils[i]) {
					return i;
				}
			}
		},

		parse : function (timestamp) {
			var target  = +timestamp,
				offsets = this.offsets,
				untils  = this.untils,
				max     = untils.length - 1,
				offset, offsetNext, offsetPrev, i;

			for (i = 0; i < max; i++) {
				offset     = offsets[i];
				offsetNext = offsets[i + 1];
				offsetPrev = offsets[i ? i - 1 : i];

				if (offset < offsetNext && tz.moveAmbiguousForward) {
					offset = offsetNext;
				} else if (offset > offsetPrev && tz.moveInvalidForward) {
					offset = offsetPrev;
				}

				if (target < untils[i] - (offset * 60000)) {
					return offsets[i];
				}
			}

			return offsets[max];
		},

		abbr : function (mom) {
			return this.abbrs[this._index(mom)];
		},

		offset : function (mom) {
			logError("zone.offset has been deprecated in favor of zone.utcOffset");
			return this.offsets[this._index(mom)];
		},

		utcOffset : function (mom) {
			return this.offsets[this._index(mom)];
		}
	};

	/************************************
		Current Timezone
	************************************/

	function OffsetAt(at) {
		var timeString = at.toTimeString();
		var abbr = timeString.match(/\([a-z ]+\)/i);
		if (abbr && abbr[0]) {
			// 17:56:31 GMT-0600 (CST)
			// 17:56:31 GMT-0600 (Central Standard Time)
			abbr = abbr[0].match(/[A-Z]/g);
			abbr = abbr ? abbr.join('') : undefined;
		} else {
			// 17:56:31 CST
			// 17:56:31 GMT+0800 (台北標準時間)
			abbr = timeString.match(/[A-Z]{3,5}/g);
			abbr = abbr ? abbr[0] : undefined;
		}

		if (abbr === 'GMT') {
			abbr = undefined;
		}

		this.at = +at;
		this.abbr = abbr;
		this.offset = at.getTimezoneOffset();
	}

	function ZoneScore(zone) {
		this.zone = zone;
		this.offsetScore = 0;
		this.abbrScore = 0;
	}

	ZoneScore.prototype.scoreOffsetAt = function (offsetAt) {
		this.offsetScore += Math.abs(this.zone.utcOffset(offsetAt.at) - offsetAt.offset);
		if (this.zone.abbr(offsetAt.at).replace(/[^A-Z]/g, '') !== offsetAt.abbr) {
			this.abbrScore++;
		}
	};

	function findChange(low, high) {
		var mid, diff;

		while ((diff = ((high.at - low.at) / 12e4 | 0) * 6e4)) {
			mid = new OffsetAt(new Date(low.at + diff));
			if (mid.offset === low.offset) {
				low = mid;
			} else {
				high = mid;
			}
		}

		return low;
	}

	function userOffsets() {
		var startYear = new Date().getFullYear() - 2,
			last = new OffsetAt(new Date(startYear, 0, 1)),
			offsets = [last],
			change, next, i;

		for (i = 1; i < 48; i++) {
			next = new OffsetAt(new Date(startYear, i, 1));
			if (next.offset !== last.offset) {
				change = findChange(last, next);
				offsets.push(change);
				offsets.push(new OffsetAt(new Date(change.at + 6e4)));
			}
			last = next;
		}

		for (i = 0; i < 4; i++) {
			offsets.push(new OffsetAt(new Date(startYear + i, 0, 1)));
			offsets.push(new OffsetAt(new Date(startYear + i, 6, 1)));
		}

		return offsets;
	}

	function sortZoneScores (a, b) {
		if (a.offsetScore !== b.offsetScore) {
			return a.offsetScore - b.offsetScore;
		}
		if (a.abbrScore !== b.abbrScore) {
			return a.abbrScore - b.abbrScore;
		}
		return b.zone.population - a.zone.population;
	}

	function addToGuesses (name, offsets) {
		var i, offset;
		arrayToInt(offsets);
		for (i = 0; i < offsets.length; i++) {
			offset = offsets[i];
			guesses[offset] = guesses[offset] || {};
			guesses[offset][name] = true;
		}
	}

	function guessesForUserOffsets (offsets) {
		var offsetsLength = offsets.length,
			filteredGuesses = {},
			out = [],
			i, j, guessesOffset;

		for (i = 0; i < offsetsLength; i++) {
			guessesOffset = guesses[offsets[i].offset] || {};
			for (j in guessesOffset) {
				if (guessesOffset.hasOwnProperty(j)) {
					filteredGuesses[j] = true;
				}
			}
		}

		for (i in filteredGuesses) {
			if (filteredGuesses.hasOwnProperty(i)) {
				out.push(names[i]);
			}
		}

		return out;
	}

	function rebuildGuess () {

		// use Intl API when available and returning valid time zone
		try {
			var intlName = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (intlName && intlName.length > 3) {
				var name = names[normalizeName(intlName)];
				if (name) {
					return name;
				}
				logError("Moment Timezone found " + intlName + " from the Intl api, but did not have that data loaded.");
			}
		} catch (e) {
			// Intl unavailable, fall back to manual guessing.
		}

		var offsets = userOffsets(),
			offsetsLength = offsets.length,
			guesses = guessesForUserOffsets(offsets),
			zoneScores = [],
			zoneScore, i, j;

		for (i = 0; i < guesses.length; i++) {
			zoneScore = new ZoneScore(getZone(guesses[i]), offsetsLength);
			for (j = 0; j < offsetsLength; j++) {
				zoneScore.scoreOffsetAt(offsets[j]);
			}
			zoneScores.push(zoneScore);
		}

		zoneScores.sort(sortZoneScores);

		return zoneScores.length > 0 ? zoneScores[0].zone.name : undefined;
	}

	function guess (ignoreCache) {
		if (!cachedGuess || ignoreCache) {
			cachedGuess = rebuildGuess();
		}
		return cachedGuess;
	}

	/************************************
		Global Methods
	************************************/

	function normalizeName (name) {
		return (name || '').toLowerCase().replace(/\//g, '_');
	}

	function addZone (packed) {
		var i, name, split, normalized;

		if (typeof packed === "string") {
			packed = [packed];
		}

		for (i = 0; i < packed.length; i++) {
			split = packed[i].split('|');
			name = split[0];
			normalized = normalizeName(name);
			zones[normalized] = packed[i];
			names[normalized] = name;
			addToGuesses(normalized, split[2].split(' '));
		}
	}

	function getZone (name, caller) {
		
		name = normalizeName(name);

		var zone = zones[name];
		var link;

		if (zone instanceof Zone) {
			return zone;
		}

		if (typeof zone === 'string') {
			zone = new Zone(zone);
			zones[name] = zone;
			return zone;
		}

		// Pass getZone to prevent recursion more than 1 level deep
		if (links[name] && caller !== getZone && (link = getZone(links[name], getZone))) {
			zone = zones[name] = new Zone();
			zone._set(link);
			zone.name = names[name];
			return zone;
		}

		return null;
	}

	function getNames () {
		var i, out = [];

		for (i in names) {
			if (names.hasOwnProperty(i) && (zones[i] || zones[links[i]]) && names[i]) {
				out.push(names[i]);
			}
		}

		return out.sort();
	}

	function addLink (aliases) {
		var i, alias, normal0, normal1;

		if (typeof aliases === "string") {
			aliases = [aliases];
		}

		for (i = 0; i < aliases.length; i++) {
			alias = aliases[i].split('|');

			normal0 = normalizeName(alias[0]);
			normal1 = normalizeName(alias[1]);

			links[normal0] = normal1;
			names[normal0] = alias[0];

			links[normal1] = normal0;
			names[normal1] = alias[1];
		}
	}

	function loadData (data) {
		addZone(data.zones);
		addLink(data.links);
		tz.dataVersion = data.version;
	}

	function zoneExists (name) {
		if (!zoneExists.didShowError) {
			zoneExists.didShowError = true;
				logError("moment.tz.zoneExists('" + name + "') has been deprecated in favor of !moment.tz.zone('" + name + "')");
		}
		return !!getZone(name);
	}

	function needsOffset (m) {
		var isUnixTimestamp = (m._f === 'X' || m._f === 'x');
		return !!(m._a && (m._tzm === undefined) && !isUnixTimestamp);
	}

	function logError (message) {
		if (typeof console !== 'undefined' && typeof console.error === 'function') {
			console.error(message);
		}
	}

	/************************************
		moment.tz namespace
	************************************/

	function tz (input) {
		var args = Array.prototype.slice.call(arguments, 0, -1),
			name = arguments[arguments.length - 1],
			zone = getZone(name),
			out  = moment.utc.apply(null, args);

		if (zone && !moment.isMoment(input) && needsOffset(out)) {
			out.add(zone.parse(out), 'minutes');
		}

		out.tz(name);

		return out;
	}

	tz.version      = VERSION;
	tz.dataVersion  = '';
	tz._zones       = zones;
	tz._links       = links;
	tz._names       = names;
	tz.add          = addZone;
	tz.link         = addLink;
	tz.load         = loadData;
	tz.zone         = getZone;
	tz.zoneExists   = zoneExists; // deprecated in 0.1.0
	tz.guess        = guess;
	tz.names        = getNames;
	tz.Zone         = Zone;
	tz.unpack       = unpack;
	tz.unpackBase60 = unpackBase60;
	tz.needsOffset  = needsOffset;
	tz.moveInvalidForward   = true;
	tz.moveAmbiguousForward = false;

	/************************************
		Interface with Moment.js
	************************************/

	var fn = moment.fn;

	moment.tz = tz;

	moment.defaultZone = null;

	moment.updateOffset = function (mom, keepTime) {
		var zone = moment.defaultZone,
			offset;

		if (mom._z === undefined) {
			if (zone && needsOffset(mom) && !mom._isUTC) {
				mom._d = moment.utc(mom._a)._d;
				mom.utc().add(zone.parse(mom), 'minutes');
			}
			mom._z = zone;
		}
		if (mom._z) {
			offset = mom._z.utcOffset(mom);
			if (Math.abs(offset) < 16) {
				offset = offset / 60;
			}
			if (mom.utcOffset !== undefined) {
				var z = mom._z;
				mom.utcOffset(-offset, keepTime);
				mom._z = z;
			} else {
				mom.zone(offset, keepTime);
			}
		}
	};

	fn.tz = function (name, keepTime) {
		if (name) {
			if (typeof name !== 'string') {
				throw new Error('Time zone name must be a string, got ' + name + ' [' + typeof name + ']');
			}
			this._z = getZone(name);
			if (this._z) {
				moment.updateOffset(this, keepTime);
			} else {
				logError("Moment Timezone has no data for " + name + ". See http://momentjs.com/timezone/docs/#/data-loading/.");
			}
			return this;
		}
		if (this._z) { return this._z.name; }
	};

	function abbrWrap (old) {
		return function () {
			if (this._z) { return this._z.abbr(this); }
			return old.call(this);
		};
	}

	function resetZoneWrap (old) {
		return function () {
			this._z = null;
			return old.apply(this, arguments);
		};
	}

	function resetZoneWrap2 (old) {
		return function () {
			if (arguments.length > 0) this._z = null;
			return old.apply(this, arguments);
		};
	}

	fn.zoneName  = abbrWrap(fn.zoneName);
	fn.zoneAbbr  = abbrWrap(fn.zoneAbbr);
	fn.utc       = resetZoneWrap(fn.utc);
	fn.local     = resetZoneWrap(fn.local);
	fn.utcOffset = resetZoneWrap2(fn.utcOffset);
	
	moment.tz.setDefault = function(name) {
		if (major < 2 || (major === 2 && minor < 9)) {
			logError('Moment Timezone setDefault() requires Moment.js >= 2.9.0. You are using Moment.js ' + moment.version + '.');
		}
		moment.defaultZone = name ? getZone(name) : null;
		return moment;
	};

	// Cloning a moment should include the _z property.
	var momentProperties = moment.momentProperties;
	if (Object.prototype.toString.call(momentProperties) === '[object Array]') {
		// moment 2.8.1+
		momentProperties.push('_z');
		momentProperties.push('_a');
	} else if (momentProperties) {
		// moment 2.7.0
		momentProperties._z = null;
	}

	loadData({
		"version": "2019a",
		"zones": [
			"Africa/Abidjan|GMT|0|0||48e5",
			"Africa/Nairobi|EAT|-30|0||47e5",
			"Africa/Algiers|CET|-10|0||26e5",
			"Africa/Lagos|WAT|-10|0||17e6",
			"Africa/Maputo|CAT|-20|0||26e5",
			"Africa/Cairo|EET EEST|-20 -30|01010|1M2m0 gL0 e10 mn0|15e6",
			"Africa/Casablanca|+00 +01|0 -10|01010101010101010101010101010101|1LHC0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 28M0 e00 2600 e00 28M0 e00 2600 gM0 2600 e00 28M0 e00|32e5",
			"Europe/Paris|CET CEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|11e6",
			"Africa/Johannesburg|SAST|-20|0||84e5",
			"Africa/Khartoum|EAT CAT|-30 -20|01|1Usl0|51e5",
			"Africa/Sao_Tome|GMT WAT|0 -10|010|1UQN0 2q00",
			"Africa/Tripoli|EET|-20|0||11e5",
			"Africa/Windhoek|CAT WAT|-20 -10|010101010|1LKo0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0|32e4",
			"America/Adak|HST HDT|a0 90|01010101010101010101010|1Lzo0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|326",
			"America/Anchorage|AKST AKDT|90 80|01010101010101010101010|1Lzn0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|30e4",
			"America/Santo_Domingo|AST|40|0||29e5",
			"America/Fortaleza|-03|30|0||34e5",
			"America/Asuncion|-03 -04|30 40|01010101010101010101010|1LEP0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1ip0|28e5",
			"America/Panama|EST|50|0||15e5",
			"America/Mexico_City|CST CDT|60 50|01010101010101010101010|1LKw0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|20e6",
			"America/Managua|CST|60|0||22e5",
			"America/La_Paz|-04|40|0||19e5",
			"America/Lima|-05|50|0||11e6",
			"America/Denver|MST MDT|70 60|01010101010101010101010|1Lzl0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|26e5",
			"America/Campo_Grande|-03 -04|30 40|01010101010101010101010|1LqP0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|77e4",
			"America/Cancun|CST CDT EST|60 50 50|0102|1LKw0 1lb0 Dd0|63e4",
			"America/Caracas|-0430 -04|4u 40|01|1QMT0|29e5",
			"America/Chicago|CST CDT|60 50|01010101010101010101010|1Lzk0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|92e5",
			"America/Chihuahua|MST MDT|70 60|01010101010101010101010|1LKx0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|81e4",
			"America/Phoenix|MST|70|0||42e5",
			"America/Los_Angeles|PST PDT|80 70|01010101010101010101010|1Lzm0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|15e6",
			"America/New_York|EST EDT|50 40|01010101010101010101010|1Lzj0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|21e6",
			"America/Fort_Nelson|PST PDT MST|80 70 70|0102|1Lzm0 1zb0 Op0|39e2",
			"America/Halifax|AST ADT|40 30|01010101010101010101010|1Lzi0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|39e4",
			"America/Godthab|-03 -02|30 20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|17e3",
			"America/Grand_Turk|EST EDT AST|50 40 40|0101210101010101010|1Lzj0 1zb0 Op0 1zb0 5Ip0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|37e2",
			"America/Havana|CST CDT|50 40|01010101010101010101010|1Lzh0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0|21e5",
			"America/Metlakatla|PST AKST AKDT|80 90 80|012121201212121212121|1PAa0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 uM0 jB0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|14e2",
			"America/Miquelon|-03 -02|30 20|01010101010101010101010|1Lzh0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|61e2",
			"America/Montevideo|-02 -03|20 30|0101|1Lzg0 1o10 11z0|17e5",
			"America/Noronha|-02|20|0||30e2",
			"America/Port-au-Prince|EST EDT|50 40|010101010101010101010|1Lzj0 1zb0 Op0 1zb0 3iN0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e5",
			"Antarctica/Palmer|-03 -04|30 40|01010|1LSP0 Rd0 46n0 Ap0|40",
			"America/Santiago|-03 -04|30 40|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|62e5",
			"America/Sao_Paulo|-02 -03|20 30|01010101010101010101010|1LqO0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|20e6",
			"Atlantic/Azores|-01 +00|10 0|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|25e4",
			"America/St_Johns|NST NDT|3u 2u|01010101010101010101010|1Lzhu 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|11e4",
			"Antarctica/Casey|+08 +11|-80 -b0|010|1RWg0 3m10|10",
			"Asia/Bangkok|+07|-70|0||15e6",
			"Pacific/Port_Moresby|+10|-a0|0||25e4",
			"Pacific/Guadalcanal|+11|-b0|0||11e4",
			"Asia/Tashkent|+05|-50|0||23e5",
			"Pacific/Auckland|NZDT NZST|-d0 -c0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|14e5",
			"Asia/Baghdad|+03|-30|0||66e5",
			"Antarctica/Troll|+00 +02|0 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|40",
			"Asia/Dhaka|+06|-60|0||16e6",
			"Asia/Amman|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00|25e5",
			"Asia/Kamchatka|+12|-c0|0||18e4",
			"Asia/Baku|+04 +05|-40 -50|01010|1LHA0 1o00 11A0 1o00|27e5",
			"Asia/Barnaul|+07 +06|-70 -60|010|1N7v0 3rd0",
			"Asia/Beirut|EET EEST|-20 -30|01010101010101010101010|1LHy0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|22e5",
			"Asia/Kuala_Lumpur|+08|-80|0||71e5",
			"Asia/Kolkata|IST|-5u|0||15e6",
			"Asia/Chita|+10 +08 +09|-a0 -80 -90|012|1N7s0 3re0|33e4",
			"Asia/Ulaanbaatar|+08 +09|-80 -90|01010|1O8G0 1cJ0 1cP0 1cJ0|12e5",
			"Asia/Shanghai|CST|-80|0||23e6",
			"Asia/Colombo|+0530|-5u|0||22e5",
			"Asia/Damascus|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0|26e5",
			"Asia/Dili|+09|-90|0||19e4",
			"Asia/Dubai|+04|-40|0||39e5",
			"Asia/Famagusta|EET EEST +03|-20 -30 -30|0101012010101010101010|1LHB0 1o00 11A0 1o00 11A0 15U0 2Ks0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Asia/Gaza|EET EEST|-20 -30|01010101010101010101010|1LGK0 1nX0 1210 1nz0 1220 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|18e5",
			"Asia/Hong_Kong|HKT|-80|0||73e5",
			"Asia/Hovd|+07 +08|-70 -80|01010|1O8H0 1cJ0 1cP0 1cJ0|81e3",
			"Asia/Irkutsk|+09 +08|-90 -80|01|1N7t0|60e4",
			"Europe/Istanbul|EET EEST +03|-20 -30 -30|0101012|1LI10 1nA0 11A0 1tA0 U00 15w0|13e6",
			"Asia/Jakarta|WIB|-70|0||31e6",
			"Asia/Jayapura|WIT|-90|0||26e4",
			"Asia/Jerusalem|IST IDT|-20 -30|01010101010101010101010|1LGM0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0|81e4",
			"Asia/Kabul|+0430|-4u|0||46e5",
			"Asia/Karachi|PKT|-50|0||24e6",
			"Asia/Kathmandu|+0545|-5J|0||12e5",
			"Asia/Yakutsk|+10 +09|-a0 -90|01|1N7s0|28e4",
			"Asia/Krasnoyarsk|+08 +07|-80 -70|01|1N7u0|10e5",
			"Asia/Magadan|+12 +10 +11|-c0 -a0 -b0|012|1N7q0 3Cq0|95e3",
			"Asia/Makassar|WITA|-80|0||15e5",
			"Asia/Manila|PST|-80|0||24e6",
			"Europe/Athens|EET EEST|-20 -30|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|35e5",
			"Asia/Novosibirsk|+07 +06|-70 -60|010|1N7v0 4eN0|15e5",
			"Asia/Omsk|+07 +06|-70 -60|01|1N7v0|12e5",
			"Asia/Pyongyang|KST KST|-90 -8u|010|1P4D0 6BA0|29e5",
			"Asia/Qyzylorda|+06 +05|-60 -50|01|1Xei0|73e4",
			"Asia/Rangoon|+0630|-6u|0||48e5",
			"Asia/Sakhalin|+11 +10|-b0 -a0|010|1N7r0 3rd0|58e4",
			"Asia/Seoul|KST|-90|0||23e6",
			"Asia/Srednekolymsk|+12 +11|-c0 -b0|01|1N7q0|35e2",
			"Asia/Tehran|+0330 +0430|-3u -4u|01010101010101010101010|1LEku 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0|14e6",
			"Asia/Tokyo|JST|-90|0||38e6",
			"Asia/Tomsk|+07 +06|-70 -60|010|1N7v0 3Qp0|10e5",
			"Asia/Vladivostok|+11 +10|-b0 -a0|01|1N7r0|60e4",
			"Asia/Yekaterinburg|+06 +05|-60 -50|01|1N7w0|14e5",
			"Europe/Lisbon|WET WEST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|27e5",
			"Atlantic/Cape_Verde|-01|10|0||50e4",
			"Australia/Sydney|AEDT AEST|-b0 -a0|01010101010101010101010|1LKg0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|40e5",
			"Australia/Adelaide|ACDT ACST|-au -9u|01010101010101010101010|1LKgu 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|11e5",
			"Australia/Brisbane|AEST|-a0|0||20e5",
			"Australia/Darwin|ACST|-9u|0||12e4",
			"Australia/Eucla|+0845|-8J|0||368",
			"Australia/Lord_Howe|+11 +1030|-b0 -au|01010101010101010101010|1LKf0 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1fzu 1cMu|347",
			"Australia/Perth|AWST|-80|0||18e5",
			"Pacific/Easter|-05 -06|50 60|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|30e2",
			"Europe/Dublin|GMT IST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|12e5",
			"Etc/GMT-1|+01|-10|0|",
			"Pacific/Fakaofo|+13|-d0|0||483",
			"Pacific/Kiritimati|+14|-e0|0||51e2",
			"Etc/GMT-2|+02|-20|0|",
			"Pacific/Tahiti|-10|a0|0||18e4",
			"Pacific/Niue|-11|b0|0||12e2",
			"Etc/GMT+12|-12|c0|0|",
			"Pacific/Galapagos|-06|60|0||25e3",
			"Etc/GMT+7|-07|70|0|",
			"Pacific/Pitcairn|-08|80|0||56",
			"Pacific/Gambier|-09|90|0||125",
			"Etc/UTC|UTC|0|0|",
			"Europe/Ulyanovsk|+04 +03|-40 -30|010|1N7y0 3rd0|13e5",
			"Europe/London|GMT BST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|10e6",
			"Europe/Chisinau|EET EEST|-20 -30|01010101010101010101010|1LHA0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|67e4",
			"Europe/Kaliningrad|+03 EET|-30 -20|01|1N7z0|44e4",
			"Europe/Kirov|+04 +03|-40 -30|01|1N7y0|48e4",
			"Europe/Moscow|MSK MSK|-40 -30|01|1N7y0|16e6",
			"Europe/Saratov|+04 +03|-40 -30|010|1N7y0 5810",
			"Europe/Simferopol|EET MSK MSK|-20 -40 -30|012|1LHA0 1nW0|33e4",
			"Europe/Volgograd|+04 +03|-40 -30|010|1N7y0 9Jd0|10e5",
			"Pacific/Honolulu|HST|a0|0||37e4",
			"MET|MET MEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Pacific/Chatham|+1345 +1245|-dJ -cJ|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|600",
			"Pacific/Apia|+14 +13|-e0 -d0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|37e3",
			"Pacific/Bougainville|+10 +11|-a0 -b0|01|1NwE0|18e4",
			"Pacific/Fiji|+13 +12|-d0 -c0|01010101010101010101010|1Lfp0 1SN0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0|88e4",
			"Pacific/Guam|ChST|-a0|0||17e4",
			"Pacific/Marquesas|-0930|9u|0||86e2",
			"Pacific/Pago_Pago|SST|b0|0||37e2",
			"Pacific/Norfolk|+1130 +11|-bu -b0|01|1PoCu|25e4",
			"Pacific/Tongatapu|+13 +14|-d0 -e0|010|1S4d0 s00|75e3"
		],
		"links": [
			"Africa/Abidjan|Africa/Accra",
			"Africa/Abidjan|Africa/Bamako",
			"Africa/Abidjan|Africa/Banjul",
			"Africa/Abidjan|Africa/Bissau",
			"Africa/Abidjan|Africa/Conakry",
			"Africa/Abidjan|Africa/Dakar",
			"Africa/Abidjan|Africa/Freetown",
			"Africa/Abidjan|Africa/Lome",
			"Africa/Abidjan|Africa/Monrovia",
			"Africa/Abidjan|Africa/Nouakchott",
			"Africa/Abidjan|Africa/Ouagadougou",
			"Africa/Abidjan|Africa/Timbuktu",
			"Africa/Abidjan|America/Danmarkshavn",
			"Africa/Abidjan|Atlantic/Reykjavik",
			"Africa/Abidjan|Atlantic/St_Helena",
			"Africa/Abidjan|Etc/GMT",
			"Africa/Abidjan|Etc/GMT+0",
			"Africa/Abidjan|Etc/GMT-0",
			"Africa/Abidjan|Etc/GMT0",
			"Africa/Abidjan|Etc/Greenwich",
			"Africa/Abidjan|GMT",
			"Africa/Abidjan|GMT+0",
			"Africa/Abidjan|GMT-0",
			"Africa/Abidjan|GMT0",
			"Africa/Abidjan|Greenwich",
			"Africa/Abidjan|Iceland",
			"Africa/Algiers|Africa/Tunis",
			"Africa/Cairo|Egypt",
			"Africa/Casablanca|Africa/El_Aaiun",
			"Africa/Johannesburg|Africa/Maseru",
			"Africa/Johannesburg|Africa/Mbabane",
			"Africa/Lagos|Africa/Bangui",
			"Africa/Lagos|Africa/Brazzaville",
			"Africa/Lagos|Africa/Douala",
			"Africa/Lagos|Africa/Kinshasa",
			"Africa/Lagos|Africa/Libreville",
			"Africa/Lagos|Africa/Luanda",
			"Africa/Lagos|Africa/Malabo",
			"Africa/Lagos|Africa/Ndjamena",
			"Africa/Lagos|Africa/Niamey",
			"Africa/Lagos|Africa/Porto-Novo",
			"Africa/Maputo|Africa/Blantyre",
			"Africa/Maputo|Africa/Bujumbura",
			"Africa/Maputo|Africa/Gaborone",
			"Africa/Maputo|Africa/Harare",
			"Africa/Maputo|Africa/Kigali",
			"Africa/Maputo|Africa/Lubumbashi",
			"Africa/Maputo|Africa/Lusaka",
			"Africa/Nairobi|Africa/Addis_Ababa",
			"Africa/Nairobi|Africa/Asmara",
			"Africa/Nairobi|Africa/Asmera",
			"Africa/Nairobi|Africa/Dar_es_Salaam",
			"Africa/Nairobi|Africa/Djibouti",
			"Africa/Nairobi|Africa/Juba",
			"Africa/Nairobi|Africa/Kampala",
			"Africa/Nairobi|Africa/Mogadishu",
			"Africa/Nairobi|Indian/Antananarivo",
			"Africa/Nairobi|Indian/Comoro",
			"Africa/Nairobi|Indian/Mayotte",
			"Africa/Tripoli|Libya",
			"America/Adak|America/Atka",
			"America/Adak|US/Aleutian",
			"America/Anchorage|America/Juneau",
			"America/Anchorage|America/Nome",
			"America/Anchorage|America/Sitka",
			"America/Anchorage|America/Yakutat",
			"America/Anchorage|US/Alaska",
			"America/Campo_Grande|America/Cuiaba",
			"America/Chicago|America/Indiana/Knox",
			"America/Chicago|America/Indiana/Tell_City",
			"America/Chicago|America/Knox_IN",
			"America/Chicago|America/Matamoros",
			"America/Chicago|America/Menominee",
			"America/Chicago|America/North_Dakota/Beulah",
			"America/Chicago|America/North_Dakota/Center",
			"America/Chicago|America/North_Dakota/New_Salem",
			"America/Chicago|America/Rainy_River",
			"America/Chicago|America/Rankin_Inlet",
			"America/Chicago|America/Resolute",
			"America/Chicago|America/Winnipeg",
			"America/Chicago|CST6CDT",
			"America/Chicago|Canada/Central",
			"America/Chicago|US/Central",
			"America/Chicago|US/Indiana-Starke",
			"America/Chihuahua|America/Mazatlan",
			"America/Chihuahua|Mexico/BajaSur",
			"America/Denver|America/Boise",
			"America/Denver|America/Cambridge_Bay",
			"America/Denver|America/Edmonton",
			"America/Denver|America/Inuvik",
			"America/Denver|America/Ojinaga",
			"America/Denver|America/Shiprock",
			"America/Denver|America/Yellowknife",
			"America/Denver|Canada/Mountain",
			"America/Denver|MST7MDT",
			"America/Denver|Navajo",
			"America/Denver|US/Mountain",
			"America/Fortaleza|America/Araguaina",
			"America/Fortaleza|America/Argentina/Buenos_Aires",
			"America/Fortaleza|America/Argentina/Catamarca",
			"America/Fortaleza|America/Argentina/ComodRivadavia",
			"America/Fortaleza|America/Argentina/Cordoba",
			"America/Fortaleza|America/Argentina/Jujuy",
			"America/Fortaleza|America/Argentina/La_Rioja",
			"America/Fortaleza|America/Argentina/Mendoza",
			"America/Fortaleza|America/Argentina/Rio_Gallegos",
			"America/Fortaleza|America/Argentina/Salta",
			"America/Fortaleza|America/Argentina/San_Juan",
			"America/Fortaleza|America/Argentina/San_Luis",
			"America/Fortaleza|America/Argentina/Tucuman",
			"America/Fortaleza|America/Argentina/Ushuaia",
			"America/Fortaleza|America/Bahia",
			"America/Fortaleza|America/Belem",
			"America/Fortaleza|America/Buenos_Aires",
			"America/Fortaleza|America/Catamarca",
			"America/Fortaleza|America/Cayenne",
			"America/Fortaleza|America/Cordoba",
			"America/Fortaleza|America/Jujuy",
			"America/Fortaleza|America/Maceio",
			"America/Fortaleza|America/Mendoza",
			"America/Fortaleza|America/Paramaribo",
			"America/Fortaleza|America/Recife",
			"America/Fortaleza|America/Rosario",
			"America/Fortaleza|America/Santarem",
			"America/Fortaleza|Antarctica/Rothera",
			"America/Fortaleza|Atlantic/Stanley",
			"America/Fortaleza|Etc/GMT+3",
			"America/Halifax|America/Glace_Bay",
			"America/Halifax|America/Goose_Bay",
			"America/Halifax|America/Moncton",
			"America/Halifax|America/Thule",
			"America/Halifax|Atlantic/Bermuda",
			"America/Halifax|Canada/Atlantic",
			"America/Havana|Cuba",
			"America/La_Paz|America/Boa_Vista",
			"America/La_Paz|America/Guyana",
			"America/La_Paz|America/Manaus",
			"America/La_Paz|America/Porto_Velho",
			"America/La_Paz|Brazil/West",
			"America/La_Paz|Etc/GMT+4",
			"America/Lima|America/Bogota",
			"America/Lima|America/Eirunepe",
			"America/Lima|America/Guayaquil",
			"America/Lima|America/Porto_Acre",
			"America/Lima|America/Rio_Branco",
			"America/Lima|Brazil/Acre",
			"America/Lima|Etc/GMT+5",
			"America/Los_Angeles|America/Dawson",
			"America/Los_Angeles|America/Ensenada",
			"America/Los_Angeles|America/Santa_Isabel",
			"America/Los_Angeles|America/Tijuana",
			"America/Los_Angeles|America/Vancouver",
			"America/Los_Angeles|America/Whitehorse",
			"America/Los_Angeles|Canada/Pacific",
			"America/Los_Angeles|Canada/Yukon",
			"America/Los_Angeles|Mexico/BajaNorte",
			"America/Los_Angeles|PST8PDT",
			"America/Los_Angeles|US/Pacific",
			"America/Los_Angeles|US/Pacific-New",
			"America/Managua|America/Belize",
			"America/Managua|America/Costa_Rica",
			"America/Managua|America/El_Salvador",
			"America/Managua|America/Guatemala",
			"America/Managua|America/Regina",
			"America/Managua|America/Swift_Current",
			"America/Managua|America/Tegucigalpa",
			"America/Managua|Canada/Saskatchewan",
			"America/Mexico_City|America/Bahia_Banderas",
			"America/Mexico_City|America/Merida",
			"America/Mexico_City|America/Monterrey",
			"America/Mexico_City|Mexico/General",
			"America/New_York|America/Detroit",
			"America/New_York|America/Fort_Wayne",
			"America/New_York|America/Indiana/Indianapolis",
			"America/New_York|America/Indiana/Marengo",
			"America/New_York|America/Indiana/Petersburg",
			"America/New_York|America/Indiana/Vevay",
			"America/New_York|America/Indiana/Vincennes",
			"America/New_York|America/Indiana/Winamac",
			"America/New_York|America/Indianapolis",
			"America/New_York|America/Iqaluit",
			"America/New_York|America/Kentucky/Louisville",
			"America/New_York|America/Kentucky/Monticello",
			"America/New_York|America/Louisville",
			"America/New_York|America/Montreal",
			"America/New_York|America/Nassau",
			"America/New_York|America/Nipigon",
			"America/New_York|America/Pangnirtung",
			"America/New_York|America/Thunder_Bay",
			"America/New_York|America/Toronto",
			"America/New_York|Canada/Eastern",
			"America/New_York|EST5EDT",
			"America/New_York|US/East-Indiana",
			"America/New_York|US/Eastern",
			"America/New_York|US/Michigan",
			"America/Noronha|Atlantic/South_Georgia",
			"America/Noronha|Brazil/DeNoronha",
			"America/Noronha|Etc/GMT+2",
			"America/Panama|America/Atikokan",
			"America/Panama|America/Cayman",
			"America/Panama|America/Coral_Harbour",
			"America/Panama|America/Jamaica",
			"America/Panama|EST",
			"America/Panama|Jamaica",
			"America/Phoenix|America/Creston",
			"America/Phoenix|America/Dawson_Creek",
			"America/Phoenix|America/Hermosillo",
			"America/Phoenix|MST",
			"America/Phoenix|US/Arizona",
			"America/Santiago|Chile/Continental",
			"America/Santo_Domingo|America/Anguilla",
			"America/Santo_Domingo|America/Antigua",
			"America/Santo_Domingo|America/Aruba",
			"America/Santo_Domingo|America/Barbados",
			"America/Santo_Domingo|America/Blanc-Sablon",
			"America/Santo_Domingo|America/Curacao",
			"America/Santo_Domingo|America/Dominica",
			"America/Santo_Domingo|America/Grenada",
			"America/Santo_Domingo|America/Guadeloupe",
			"America/Santo_Domingo|America/Kralendijk",
			"America/Santo_Domingo|America/Lower_Princes",
			"America/Santo_Domingo|America/Marigot",
			"America/Santo_Domingo|America/Martinique",
			"America/Santo_Domingo|America/Montserrat",
			"America/Santo_Domingo|America/Port_of_Spain",
			"America/Santo_Domingo|America/Puerto_Rico",
			"America/Santo_Domingo|America/St_Barthelemy",
			"America/Santo_Domingo|America/St_Kitts",
			"America/Santo_Domingo|America/St_Lucia",
			"America/Santo_Domingo|America/St_Thomas",
			"America/Santo_Domingo|America/St_Vincent",
			"America/Santo_Domingo|America/Tortola",
			"America/Santo_Domingo|America/Virgin",
			"America/Sao_Paulo|Brazil/East",
			"America/St_Johns|Canada/Newfoundland",
			"Antarctica/Palmer|America/Punta_Arenas",
			"Asia/Baghdad|Antarctica/Syowa",
			"Asia/Baghdad|Asia/Aden",
			"Asia/Baghdad|Asia/Bahrain",
			"Asia/Baghdad|Asia/Kuwait",
			"Asia/Baghdad|Asia/Qatar",
			"Asia/Baghdad|Asia/Riyadh",
			"Asia/Baghdad|Etc/GMT-3",
			"Asia/Baghdad|Europe/Minsk",
			"Asia/Bangkok|Antarctica/Davis",
			"Asia/Bangkok|Asia/Ho_Chi_Minh",
			"Asia/Bangkok|Asia/Novokuznetsk",
			"Asia/Bangkok|Asia/Phnom_Penh",
			"Asia/Bangkok|Asia/Saigon",
			"Asia/Bangkok|Asia/Vientiane",
			"Asia/Bangkok|Etc/GMT-7",
			"Asia/Bangkok|Indian/Christmas",
			"Asia/Dhaka|Antarctica/Vostok",
			"Asia/Dhaka|Asia/Almaty",
			"Asia/Dhaka|Asia/Bishkek",
			"Asia/Dhaka|Asia/Dacca",
			"Asia/Dhaka|Asia/Kashgar",
			"Asia/Dhaka|Asia/Qostanay",
			"Asia/Dhaka|Asia/Thimbu",
			"Asia/Dhaka|Asia/Thimphu",
			"Asia/Dhaka|Asia/Urumqi",
			"Asia/Dhaka|Etc/GMT-6",
			"Asia/Dhaka|Indian/Chagos",
			"Asia/Dili|Etc/GMT-9",
			"Asia/Dili|Pacific/Palau",
			"Asia/Dubai|Asia/Muscat",
			"Asia/Dubai|Asia/Tbilisi",
			"Asia/Dubai|Asia/Yerevan",
			"Asia/Dubai|Etc/GMT-4",
			"Asia/Dubai|Europe/Samara",
			"Asia/Dubai|Indian/Mahe",
			"Asia/Dubai|Indian/Mauritius",
			"Asia/Dubai|Indian/Reunion",
			"Asia/Gaza|Asia/Hebron",
			"Asia/Hong_Kong|Hongkong",
			"Asia/Jakarta|Asia/Pontianak",
			"Asia/Jerusalem|Asia/Tel_Aviv",
			"Asia/Jerusalem|Israel",
			"Asia/Kamchatka|Asia/Anadyr",
			"Asia/Kamchatka|Etc/GMT-12",
			"Asia/Kamchatka|Kwajalein",
			"Asia/Kamchatka|Pacific/Funafuti",
			"Asia/Kamchatka|Pacific/Kwajalein",
			"Asia/Kamchatka|Pacific/Majuro",
			"Asia/Kamchatka|Pacific/Nauru",
			"Asia/Kamchatka|Pacific/Tarawa",
			"Asia/Kamchatka|Pacific/Wake",
			"Asia/Kamchatka|Pacific/Wallis",
			"Asia/Kathmandu|Asia/Katmandu",
			"Asia/Kolkata|Asia/Calcutta",
			"Asia/Kuala_Lumpur|Asia/Brunei",
			"Asia/Kuala_Lumpur|Asia/Kuching",
			"Asia/Kuala_Lumpur|Asia/Singapore",
			"Asia/Kuala_Lumpur|Etc/GMT-8",
			"Asia/Kuala_Lumpur|Singapore",
			"Asia/Makassar|Asia/Ujung_Pandang",
			"Asia/Rangoon|Asia/Yangon",
			"Asia/Rangoon|Indian/Cocos",
			"Asia/Seoul|ROK",
			"Asia/Shanghai|Asia/Chongqing",
			"Asia/Shanghai|Asia/Chungking",
			"Asia/Shanghai|Asia/Harbin",
			"Asia/Shanghai|Asia/Macao",
			"Asia/Shanghai|Asia/Macau",
			"Asia/Shanghai|Asia/Taipei",
			"Asia/Shanghai|PRC",
			"Asia/Shanghai|ROC",
			"Asia/Tashkent|Antarctica/Mawson",
			"Asia/Tashkent|Asia/Aqtau",
			"Asia/Tashkent|Asia/Aqtobe",
			"Asia/Tashkent|Asia/Ashgabat",
			"Asia/Tashkent|Asia/Ashkhabad",
			"Asia/Tashkent|Asia/Atyrau",
			"Asia/Tashkent|Asia/Dushanbe",
			"Asia/Tashkent|Asia/Oral",
			"Asia/Tashkent|Asia/Samarkand",
			"Asia/Tashkent|Etc/GMT-5",
			"Asia/Tashkent|Indian/Kerguelen",
			"Asia/Tashkent|Indian/Maldives",
			"Asia/Tehran|Iran",
			"Asia/Tokyo|Japan",
			"Asia/Ulaanbaatar|Asia/Choibalsan",
			"Asia/Ulaanbaatar|Asia/Ulan_Bator",
			"Asia/Vladivostok|Asia/Ust-Nera",
			"Asia/Yakutsk|Asia/Khandyga",
			"Atlantic/Azores|America/Scoresbysund",
			"Atlantic/Cape_Verde|Etc/GMT+1",
			"Australia/Adelaide|Australia/Broken_Hill",
			"Australia/Adelaide|Australia/South",
			"Australia/Adelaide|Australia/Yancowinna",
			"Australia/Brisbane|Australia/Lindeman",
			"Australia/Brisbane|Australia/Queensland",
			"Australia/Darwin|Australia/North",
			"Australia/Lord_Howe|Australia/LHI",
			"Australia/Perth|Australia/West",
			"Australia/Sydney|Australia/ACT",
			"Australia/Sydney|Australia/Canberra",
			"Australia/Sydney|Australia/Currie",
			"Australia/Sydney|Australia/Hobart",
			"Australia/Sydney|Australia/Melbourne",
			"Australia/Sydney|Australia/NSW",
			"Australia/Sydney|Australia/Tasmania",
			"Australia/Sydney|Australia/Victoria",
			"Etc/UTC|Etc/UCT",
			"Etc/UTC|Etc/Universal",
			"Etc/UTC|Etc/Zulu",
			"Etc/UTC|UCT",
			"Etc/UTC|UTC",
			"Etc/UTC|Universal",
			"Etc/UTC|Zulu",
			"Europe/Athens|Asia/Nicosia",
			"Europe/Athens|EET",
			"Europe/Athens|Europe/Bucharest",
			"Europe/Athens|Europe/Helsinki",
			"Europe/Athens|Europe/Kiev",
			"Europe/Athens|Europe/Mariehamn",
			"Europe/Athens|Europe/Nicosia",
			"Europe/Athens|Europe/Riga",
			"Europe/Athens|Europe/Sofia",
			"Europe/Athens|Europe/Tallinn",
			"Europe/Athens|Europe/Uzhgorod",
			"Europe/Athens|Europe/Vilnius",
			"Europe/Athens|Europe/Zaporozhye",
			"Europe/Chisinau|Europe/Tiraspol",
			"Europe/Dublin|Eire",
			"Europe/Istanbul|Asia/Istanbul",
			"Europe/Istanbul|Turkey",
			"Europe/Lisbon|Atlantic/Canary",
			"Europe/Lisbon|Atlantic/Faeroe",
			"Europe/Lisbon|Atlantic/Faroe",
			"Europe/Lisbon|Atlantic/Madeira",
			"Europe/Lisbon|Portugal",
			"Europe/Lisbon|WET",
			"Europe/London|Europe/Belfast",
			"Europe/London|Europe/Guernsey",
			"Europe/London|Europe/Isle_of_Man",
			"Europe/London|Europe/Jersey",
			"Europe/London|GB",
			"Europe/London|GB-Eire",
			"Europe/Moscow|W-SU",
			"Europe/Paris|Africa/Ceuta",
			"Europe/Paris|Arctic/Longyearbyen",
			"Europe/Paris|Atlantic/Jan_Mayen",
			"Europe/Paris|CET",
			"Europe/Paris|Europe/Amsterdam",
			"Europe/Paris|Europe/Andorra",
			"Europe/Paris|Europe/Belgrade",
			"Europe/Paris|Europe/Berlin",
			"Europe/Paris|Europe/Bratislava",
			"Europe/Paris|Europe/Brussels",
			"Europe/Paris|Europe/Budapest",
			"Europe/Paris|Europe/Busingen",
			"Europe/Paris|Europe/Copenhagen",
			"Europe/Paris|Europe/Gibraltar",
			"Europe/Paris|Europe/Ljubljana",
			"Europe/Paris|Europe/Luxembourg",
			"Europe/Paris|Europe/Madrid",
			"Europe/Paris|Europe/Malta",
			"Europe/Paris|Europe/Monaco",
			"Europe/Paris|Europe/Oslo",
			"Europe/Paris|Europe/Podgorica",
			"Europe/Paris|Europe/Prague",
			"Europe/Paris|Europe/Rome",
			"Europe/Paris|Europe/San_Marino",
			"Europe/Paris|Europe/Sarajevo",
			"Europe/Paris|Europe/Skopje",
			"Europe/Paris|Europe/Stockholm",
			"Europe/Paris|Europe/Tirane",
			"Europe/Paris|Europe/Vaduz",
			"Europe/Paris|Europe/Vatican",
			"Europe/Paris|Europe/Vienna",
			"Europe/Paris|Europe/Warsaw",
			"Europe/Paris|Europe/Zagreb",
			"Europe/Paris|Europe/Zurich",
			"Europe/Paris|Poland",
			"Europe/Ulyanovsk|Europe/Astrakhan",
			"Pacific/Auckland|Antarctica/McMurdo",
			"Pacific/Auckland|Antarctica/South_Pole",
			"Pacific/Auckland|NZ",
			"Pacific/Chatham|NZ-CHAT",
			"Pacific/Easter|Chile/EasterIsland",
			"Pacific/Fakaofo|Etc/GMT-13",
			"Pacific/Fakaofo|Pacific/Enderbury",
			"Pacific/Galapagos|Etc/GMT+6",
			"Pacific/Gambier|Etc/GMT+9",
			"Pacific/Guadalcanal|Antarctica/Macquarie",
			"Pacific/Guadalcanal|Etc/GMT-11",
			"Pacific/Guadalcanal|Pacific/Efate",
			"Pacific/Guadalcanal|Pacific/Kosrae",
			"Pacific/Guadalcanal|Pacific/Noumea",
			"Pacific/Guadalcanal|Pacific/Pohnpei",
			"Pacific/Guadalcanal|Pacific/Ponape",
			"Pacific/Guam|Pacific/Saipan",
			"Pacific/Honolulu|HST",
			"Pacific/Honolulu|Pacific/Johnston",
			"Pacific/Honolulu|US/Hawaii",
			"Pacific/Kiritimati|Etc/GMT-14",
			"Pacific/Niue|Etc/GMT+11",
			"Pacific/Pago_Pago|Pacific/Midway",
			"Pacific/Pago_Pago|Pacific/Samoa",
			"Pacific/Pago_Pago|US/Samoa",
			"Pacific/Pitcairn|Etc/GMT+8",
			"Pacific/Port_Moresby|Antarctica/DumontDUrville",
			"Pacific/Port_Moresby|Etc/GMT-10",
			"Pacific/Port_Moresby|Pacific/Chuuk",
			"Pacific/Port_Moresby|Pacific/Truk",
			"Pacific/Port_Moresby|Pacific/Yap",
			"Pacific/Tahiti|Etc/GMT+10",
			"Pacific/Tahiti|Pacific/Rarotonga"
		]
	});


	return moment;
}));
//! moment.js locale configuration

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


    var symbolMap = {
        '1': '١',
        '2': '٢',
        '3': '٣',
        '4': '٤',
        '5': '٥',
        '6': '٦',
        '7': '٧',
        '8': '٨',
        '9': '٩',
        '0': '٠'
    }, numberMap = {
        '١': '1',
        '٢': '2',
        '٣': '3',
        '٤': '4',
        '٥': '5',
        '٦': '6',
        '٧': '7',
        '٨': '8',
        '٩': '9',
        '٠': '0'
    }, pluralForm = function (n) {
        return n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n % 100 >= 3 && n % 100 <= 10 ? 3 : n % 100 >= 11 ? 4 : 5;
    }, plurals = {
        s : ['أقل من ثانية', 'ثانية واحدة', ['ثانيتان', 'ثانيتين'], '%d ثوان', '%d ثانية', '%d ثانية'],
        m : ['أقل من دقيقة', 'دقيقة واحدة', ['دقيقتان', 'دقيقتين'], '%d دقائق', '%d دقيقة', '%d دقيقة'],
        h : ['أقل من ساعة', 'ساعة واحدة', ['ساعتان', 'ساعتين'], '%d ساعات', '%d ساعة', '%d ساعة'],
        d : ['أقل من يوم', 'يوم واحد', ['يومان', 'يومين'], '%d أيام', '%d يومًا', '%d يوم'],
        M : ['أقل من شهر', 'شهر واحد', ['شهران', 'شهرين'], '%d أشهر', '%d شهرا', '%d شهر'],
        y : ['أقل من عام', 'عام واحد', ['عامان', 'عامين'], '%d أعوام', '%d عامًا', '%d عام']
    }, pluralize = function (u) {
        return function (number, withoutSuffix, string, isFuture) {
            var f = pluralForm(number),
                str = plurals[u][pluralForm(number)];
            if (f === 2) {
                str = str[withoutSuffix ? 0 : 1];
            }
            return str.replace(/%d/i, number);
        };
    }, months = [
        'يناير',
        'فبراير',
        'مارس',
        'أبريل',
        'مايو',
        'يونيو',
        'يوليو',
        'أغسطس',
        'سبتمبر',
        'أكتوبر',
        'نوفمبر',
        'ديسمبر'
    ];

    var ar = moment.defineLocale('ar', {
        months : months,
        monthsShort : months,
        weekdays : 'الأحد_الإثنين_الثلاثاء_الأربعاء_الخميس_الجمعة_السبت'.split('_'),
        weekdaysShort : 'أحد_إثنين_ثلاثاء_أربعاء_خميس_جمعة_سبت'.split('_'),
        weekdaysMin : 'ح_ن_ث_ر_خ_ج_س'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'D/\u200FM/\u200FYYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY HH:mm',
            LLLL : 'dddd D MMMM YYYY HH:mm'
        },
        meridiemParse: /ص|م/,
        isPM : function (input) {
            return 'م' === input;
        },
        meridiem : function (hour, minute, isLower) {
            if (hour < 12) {
                return 'ص';
            } else {
                return 'م';
            }
        },
        calendar : {
            sameDay: '[اليوم عند الساعة] LT',
            nextDay: '[غدًا عند الساعة] LT',
            nextWeek: 'dddd [عند الساعة] LT',
            lastDay: '[أمس عند الساعة] LT',
            lastWeek: 'dddd [عند الساعة] LT',
            sameElse: 'L'
        },
        relativeTime : {
            future : 'بعد %s',
            past : 'منذ %s',
            s : pluralize('s'),
            ss : pluralize('s'),
            m : pluralize('m'),
            mm : pluralize('m'),
            h : pluralize('h'),
            hh : pluralize('h'),
            d : pluralize('d'),
            dd : pluralize('d'),
            M : pluralize('M'),
            MM : pluralize('M'),
            y : pluralize('y'),
            yy : pluralize('y')
        },
        preparse: function (string) {
            return string.replace(/[١٢٣٤٥٦٧٨٩٠]/g, function (match) {
                return numberMap[match];
            }).replace(/،/g, ',');
        },
        postformat: function (string) {
            return string.replace(/\d/g, function (match) {
                return symbolMap[match];
            }).replace(/,/g, '،');
        },
        week : {
            dow : 6, // Saturday is the first day of the week.
            doy : 12  // The week that contains Jan 12th is the first week of the year.
        }
    });

    return ar;

})));

// moment-timezone-localization for lang code: ar

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"أبيدجان","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"أكرا","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"أديس أبابا","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"الجزائر","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"أسمرة","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"باماكو","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"بانغوي","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"بانجول","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"بيساو","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"بلانتاير","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"برازافيل","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"بوجومبورا","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"القاهرة","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"الدار البيضاء","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"سيتا","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"كوناكري","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"داكار","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"دار السلام","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"جيبوتي","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"دوالا","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"العيون","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"فري تاون","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"غابورون","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"هراري","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"جوهانسبرغ","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"جوبا","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"كامبالا","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"الخرطوم","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"كيغالي","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"كينشاسا","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"لاغوس","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"ليبرفيل","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"لومي","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"لواندا","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"لومبباشا","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"لوساكا","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"مالابو","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"مابوتو","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"ماسيرو","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"مباباني","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"مقديشيو","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"مونروفيا","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"نيروبي","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"نجامينا","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"نيامي","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"نواكشوط","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"واغادوغو","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"بورتو نوفو","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"ساو تومي","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"طرابلس","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"تونس","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"ويندهوك","id":"Africa/Windhoek"},{"value":"America/Adak","name":"أداك","id":"America/Adak"},{"value":"America/Anchorage","name":"أنشوراج","id":"America/Anchorage"},{"value":"America/Anguilla","name":"أنغويلا","id":"America/Anguilla"},{"value":"America/Antigua","name":"أنتيغوا","id":"America/Antigua"},{"value":"America/Araguaina","name":"أروجوانيا","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"لا ريوجا","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"ريو جالييوس","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"سالطا","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"سان خوان","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"سان لويس","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"تاكمان","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"أشوا","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"أروبا","id":"America/Aruba"},{"value":"America/Asuncion","name":"أسونسيون","id":"America/Asuncion"},{"value":"America/Bahia","name":"باهيا","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"باهيا بانديراس","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"بربادوس","id":"America/Barbados"},{"value":"America/Belem","name":"بلم","id":"America/Belem"},{"value":"America/Belize","name":"بليز","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"بلانك-سابلون","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"باو فيستا","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"بوغوتا","id":"America/Bogota"},{"value":"America/Boise","name":"بويس","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"بوينوس أيرس","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"كامبرديج باي","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"كومبو جراند","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"كانكون","id":"America/Cancun"},{"value":"America/Caracas","name":"كاراكاس","id":"America/Caracas"},{"value":"America/Catamarca","name":"كاتاماركا","id":"America/Catamarca"},{"value":"America/Cayenne","name":"كايين","id":"America/Cayenne"},{"value":"America/Cayman","name":"كايمان","id":"America/Cayman"},{"value":"America/Chicago","name":"شيكاغو","id":"America/Chicago"},{"value":"America/Chihuahua","name":"تشيواوا","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"كورال هاربر","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"كوردوبا","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"كوستاريكا","id":"America/Costa_Rica"},{"value":"America/Creston","name":"كريستون","id":"America/Creston"},{"value":"America/Cuiaba","name":"كيابا","id":"America/Cuiaba"},{"value":"America/Curacao","name":"كوراساو","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"دانمرك شافن","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"داوسان","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"داوسن كريك","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"دنفر","id":"America/Denver"},{"value":"America/Detroit","name":"ديترويت","id":"America/Detroit"},{"value":"America/Dominica","name":"دومينيكا","id":"America/Dominica"},{"value":"America/Edmonton","name":"ايدمونتون","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"ايرونبي","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"السلفادور","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"فورت نيلسون","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"فورتاليزا","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"جلاس باي","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"غودثاب","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"جوس باي","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"غراند ترك","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"غرينادا","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"غوادلوب","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"غواتيمالا","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"غواياكويل","id":"America/Guayaquil"},{"value":"America/Guyana","name":"غيانا","id":"America/Guyana"},{"value":"America/Halifax","name":"هاليفاكس","id":"America/Halifax"},{"value":"America/Havana","name":"هافانا","id":"America/Havana"},{"value":"America/Hermosillo","name":"هيرموسيلو","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"كونكس","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"مارنجو","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"بيترسبرغ","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"مدينة تل، إنديانا","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"فيفاي","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"فينسينس","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"ويناماك","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"إنديانابوليس","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"اينوفيك","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"اكويلت","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"جامايكا","id":"America/Jamaica"},{"value":"America/Jujuy","name":"جوجو","id":"America/Jujuy"},{"value":"America/Juneau","name":"جوني","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"مونتيسيلو","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"كرالنديك","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"لا باز","id":"America/La_Paz"},{"value":"America/Lima","name":"ليما","id":"America/Lima"},{"value":"America/Los_Angeles","name":"لوس انجلوس","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"لويس فيل","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"حي الأمير السفلي","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"ماشيو","id":"America/Maceio"},{"value":"America/Managua","name":"ماناغوا","id":"America/Managua"},{"value":"America/Manaus","name":"ماناوس","id":"America/Manaus"},{"value":"America/Marigot","name":"ماريغوت","id":"America/Marigot"},{"value":"America/Martinique","name":"المارتينيك","id":"America/Martinique"},{"value":"America/Matamoros","name":"ماتاموروس","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"مازاتلان","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"ميندوزا","id":"America/Mendoza"},{"value":"America/Menominee","name":"مينوميني","id":"America/Menominee"},{"value":"America/Merida","name":"ميريدا","id":"America/Merida"},{"value":"America/Metlakatla","name":"ميتلاكاتلا","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"مكسيكو سيتي","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"مكويلون","id":"America/Miquelon"},{"value":"America/Moncton","name":"وينكتون","id":"America/Moncton"},{"value":"America/Monterrey","name":"مونتيري","id":"America/Monterrey"},{"value":"America/Montevideo","name":"مونتفيديو","id":"America/Montevideo"},{"value":"America/Montserrat","name":"مونتسيرات","id":"America/Montserrat"},{"value":"America/Nassau","name":"ناسو","id":"America/Nassau"},{"value":"America/New_York","name":"نيويورك","id":"America/New_York"},{"value":"America/Nipigon","name":"نيبيجون","id":"America/Nipigon"},{"value":"America/Nome","name":"نوم","id":"America/Nome"},{"value":"America/Noronha","name":"نوروناه","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"بيولا، داكوتا الشمالية","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"سنتر","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"نيو ساليم","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"أوجيناجا","id":"America/Ojinaga"},{"value":"America/Panama","name":"بنما","id":"America/Panama"},{"value":"America/Pangnirtung","name":"بانجينتينج","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"باراماريبو","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"فينكس","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"بورت أو برنس","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"بورت أوف سبين","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"بورتو فيلو","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"بورتوريكو","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"بونتا أريناز","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"راني ريفر","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"رانكن انلت","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"ريسيف","id":"America/Recife"},{"value":"America/Regina","name":"ريجينا","id":"America/Regina"},{"value":"America/Resolute","name":"ريزولوت","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"ريوبرانكو","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"سانتا إيزابيل","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"سانتاريم","id":"America/Santarem"},{"value":"America/Santiago","name":"سانتياغو","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"سانتو دومينغو","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"ساو باولو","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"سكورسبيسند","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"سيتكا","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"سانت بارتيليمي","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"سانت جونس","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"سانت كيتس","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"سانت لوشيا","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"سانت توماس","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"سانت فنسنت","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"سوفت كارنت","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"تيغوسيغالبا","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"ثيل","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"ثندر باي","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"تيخوانا","id":"America/Tijuana"},{"value":"America/Toronto","name":"تورونتو","id":"America/Toronto"},{"value":"America/Tortola","name":"تورتولا","id":"America/Tortola"},{"value":"America/Vancouver","name":"فانكوفر","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"وايت هورس","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"وينيبيج","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"ياكوتات","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"يلونيف","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"كاساي","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"دافيز","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"دي مونت دو روفيل","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"ماكواري","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"ماوسون","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"ماك موردو","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"بالمير","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"روثيرا","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"سايووا","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"ترول","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"فوستوك","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"لونجيربين","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"عدن","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"ألماتي","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"عمان","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"أندير","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"أكتاو","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"أكتوب","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"عشق آباد","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"أتيراو","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"بغداد","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"البحرين","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"باكو","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"بانكوك","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"بارناول","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"بيروت","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"بشكيك","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"بروناي","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"كالكتا","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"تشيتا","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"تشوبالسان","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"كولومبو","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"دمشق","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"دكا","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"ديلي","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"دبي","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"دوشانبي","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"فاماغوستا","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"غزة","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"هيبرون (مدينة الخليل)","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"هونغ كونغ","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"هوفد","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"ايركيتسك","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"جاكرتا","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"جايابيورا","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"القدس","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"كابول","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"كامتشاتكا","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"كراتشي","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"كاتماندو","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"خانديجا","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"كراسنويارسك","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"كوالا لامبور","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"كيشينج","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"الكويت","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"ماكاو","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"مجادن","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"ماكسار","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"مانيلا","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"مسقط","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"نيقوسيا","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"نوفوكوزنتسك","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"نوفوسبيرسك","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"أومسك","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"أورال","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"بنوم بنه","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"بونتيانك","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"بيونغ يانغ","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"قطر","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"كيزيلوردا","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"رانغون","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"الرياض","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"مدينة هو تشي منة","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"سكالين","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"سمرقند","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"سول","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"شنغهاي","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"سنغافورة","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"سريدنكوليمسك","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"تايبيه","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"طشقند","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"تبليسي","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"طهران","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"تيمفو","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"طوكيو","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"تومسك","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"آلانباتار","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"أرومكي","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"أوست نيرا","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"فيانتيان","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"فلاديفوستك","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"ياكتسك","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"يكاترنبيرج","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"يريفان","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"أزورس","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"برمودا","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"كناري","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"الرأس الأخضر","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"فارو","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"ماديرا","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"ريكيافيك","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"جورجيا الجنوبية","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"سانت هيلينا","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"استانلي","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"أديليد","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"برسيبان","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"بروكن هيل","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"كوري","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"دارون","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"أوكلا","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"هوبارت","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"ليندمان","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"لورد هاو","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"ميلبورن","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"برثا","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"سيدني","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"التوقيت العالمي المنسق","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"أمستردام","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"أندورا","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"أستراخان","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"أثينا","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"بلغراد","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"برلين","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"براتيسلافا","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"بروكسل","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"بوخارست","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"بودابست","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"بوسنغن","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"تشيسيناو","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"كوبنهاغن","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"توقيت أيرلندا الرسميدبلن","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"جبل طارق","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"غيرنزي","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"هلسنكي","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"جزيرة مان","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"إسطنبول","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"جيرسي","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"كالينجراد","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"كييف","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"كيروف","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"لشبونة","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"ليوبليانا","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"توقيت بريطانيا الصيفيلندن","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"لوكسمبورغ","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"مدريد","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"مالطة","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"ماريهامن","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"مينسك","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"موناكو","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"موسكو","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"أوسلو","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"باريس","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"بودغوريكا","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"براغ","id":"Europe/Prague"},{"value":"Europe/Riga","name":"ريغا","id":"Europe/Riga"},{"value":"Europe/Rome","name":"روما","id":"Europe/Rome"},{"value":"Europe/Samara","name":"سمراء","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"سان مارينو","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"سراييفو","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"ساراتوف","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"سيمفروبول","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"سكوبي","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"صوفيا","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"ستوكهولم","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"تالين","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"تيرانا","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"أوليانوفسك","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"أوزجرود","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"فادوز","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"الفاتيكان","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"فيينا","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"فيلنيوس","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"فولوجراد","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"وارسو","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"زغرب","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"زابوروزي","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"زيورخ","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"أنتاناناريفو","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"تشاغوس","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"كريسماس","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"كوكوس","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"جزر القمر","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"كيرغويلين","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"ماهي","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"المالديف","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"موريشيوس","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"مايوت","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"ريونيون","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"أبيا","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"أوكلاند","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"بوغانفيل","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"تشاثام","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"استر","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"إيفات","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"اندربيرج","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"فاكاوفو","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"فيجي","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"فونافوتي","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"جلاباجوس","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"جامبير","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"غوادالكانال","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"غوام","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"هونولولو","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"جونستون","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"كيريتي ماتي","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"كوسرا","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"كواجالين","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"ماجورو","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"ماركيساس","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"ميدواي","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"ناورو","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"نيوي","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"نورفولك","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"نوميا","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"باغو باغو","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"بالاو","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"بيتكيرن","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"باناب","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"بور مورسبي","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"راروتونغا","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"سايبان","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"تاهيتي","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"تاراوا","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"تونغاتابو","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"ترك","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"واك","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"واليس","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
