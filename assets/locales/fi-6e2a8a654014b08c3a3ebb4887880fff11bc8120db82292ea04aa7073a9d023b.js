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
I18n._compiledMFs = {"logs_error_rate_notice.reached_hour_MF" : function(d){
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
})() + " virhe/tunti";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " virhettä/tunti";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> saavutti sivustoasetuskynnyksen ";
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
})() + " virhe/tunti";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " virhettä/tunti";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.reached_minute_MF" : function(d){
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
})() + " virhe/minuutti";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " virhettä/minuutti";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> saavutti sivustoasetuskynnyksen ";
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
})() + " virhe/minuutti";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " virhettä/minuutti";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
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
})() + " virhe/tunti";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " virhettä/tunti";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> ylitti sivustoasetuskynnyksen ";
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
})() + " virhe/tunti";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " virhettä/tunti";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.exceeded_minute_MF" : function(d){
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
})() + " virhe/minuutti";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " virhettä/minuutti";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> ylitti sivustoasetuskynnyksen ";
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
})() + " virhe/minuutti";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " virhettä/minuutti";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "topic.read_more_MF" : function(d){
var r = "";
r += "Sinulla on ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "UNREAD";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 ketju</a>, jossa on viestejä ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " ketjua</a>, joissa on viestejä ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "NEW";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "ja ";
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
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>1 uusi</a> ketju";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "ja ";
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
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " uutta ketjua</a>";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " lukematta. Tai ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "selaile aluetta ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
return r;
},
"false" : function(d){
var r = "";
r += "katsele ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
r += ".";
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
r += "Olet poistamassa ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> viestin";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> viestiä";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ja ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> ketjun";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> ketjua";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " tältä käyttäjältä, poistamassa käyttäjätilin, estämässä uusien tunnusten luonnin IP-osoitteestaan <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> ja lisäämässä sähköpostiosoitteensa <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> pysyvälle estolistalle. Oletko varma, että käyttäjä todella on roskapostittaja?";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "Tässä ketjussa on ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 vastaus";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " vastausta";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += ", joilla on suuri määrä tykkäyksiä suhteessa viestien määrään";
return r;
},
"med" : function(d){
var r = "";
r += ", joilla on erittäin suuri määrä tykkäyksiä suhteessa viestien määrään";
return r;
},
"high" : function(d){
var r = "";
r += ", joilla on äärimmäisen suuri määrä tykkäyksiä suhteessa viestien määrään";
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
r += "Olet poistamassa ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 viestin";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " viestiä";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ja ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 ketjun";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " ketjua";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Oletko varma?";
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
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["fi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "topic.bumped_at_title_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected [a-zA-Z$_] but \"%u9996\" found. at undefined:1376:10";}};
MessageFormat.locale.fi = function ( n ) {
  if ( n === 1 ) {
    return "one";
  }
  return "other";
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

I18n.translations = {"fi":{"js":{"number":{"format":{"separator":",","delimiter":" "},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Tavu","other":"Tavua"},"gb":"Gt","kb":"Kt","mb":"Mt","tb":"Tt"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"H:mm","time_with_zone":"H:mm (z)","time_short_day":"ddd HH:mm","timeline_date":"MMM YYYY","long_no_year_no_time":"D. MMMM[ta]","full_no_year_no_time":"Do MMMM[ta]","long_with_year":"D. MMMM[ta] YYYY H:mm","long_with_year_no_time":"D. MMMM[ta] YYYY","full_with_year_no_time":"Do MMMM[ta] YYYY","long_date_with_year":"D. MMMM[ta] YYYY LT","long_date_without_year":"D. MMMM[ta] LT","long_date_with_year_without_time":"D. MMMM[ta] YYYY","long_date_without_year_with_linebreak":"D. MMMM[ta] \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D. MMMM[ta] YYYY \u003cbr/\u003eLT","wrap_ago":"%{date} sitten","tiny":{"half_a_minute":"\u003c 1 min","less_than_x_seconds":{"one":"\u003c %{count} s","other":"\u003c %{count} s"},"x_seconds":{"one":"%{count} s","other":"%{count} s"},"less_than_x_minutes":{"one":"\u003c %{count} min","other":"\u003c %{count}min"},"x_minutes":{"one":"%{count} min","other":"%{count} min"},"about_x_hours":{"one":"%{count} t","other":"%{count} t"},"x_days":{"one":"%{count} pv","other":"%{count} pv"},"x_months":{"one":"%{count} kk","other":"%{count} kk"},"about_x_years":{"one":"%{count} v","other":"%{count} v"},"over_x_years":{"one":"\u003e %{count} v","other":"\u003e %{count} v"},"almost_x_years":{"one":"%{count} v","other":"%{count} v"},"date_month":"D. MMM","date_year":"MMM -YY"},"medium":{"x_minutes":{"one":"%{count} minuutti","other":"%{count} minuuttia"},"x_hours":{"one":"tunti","other":"%{count} tuntia"},"x_days":{"one":"%{count} päivä","other":"%{count} päivää"},"date_year":"MMMM YYYY"},"medium_with_ago":{"x_minutes":{"one":"minuutti sitten","other":"%{count} minuuttia sitten"},"x_hours":{"one":"tunti sitten","other":"%{count} tuntia sitten"},"x_days":{"one":"%{count} päivä sitten","other":"%{count} päivää sitten"},"x_months":{"one":"%{count} kuukausi sitten","other":"%{count} kuukautta sitten"},"x_years":{"one":"%{count} vuosi sitten","other":"%{count} vuotta sitten"}},"later":{"x_days":{"one":"%{count} päivä myöhemmin","other":"%{count} päivää myöhemmin"},"x_months":{"one":"%{count} kuukausi myöhemmin","other":"%{count} kuukautta myöhemmin"},"x_years":{"one":"%{count} vuosi myöhemmin","other":"%{count} vuotta myöhemmin"}},"previous_month":"Edellinen kuukausi","next_month":"Seuraava kuukausi","placeholder":"päivämäärä"},"share":{"topic_html":"Ketju: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"%{postNumber}. viesti","close":"sulje","twitter":"Jaa linkki Twitterissä","facebook":"Jaa linkki Facebookissa","email":"Jaa linkki sähköpostissa"},"action_codes":{"public_topic":"teki ketjusta julkisen %{when}","private_topic":"muutti ketjun yksityiskeskusteluksi %{when}","split_topic":"pilkkoi tämän ketjun %{when}","invited_user":"kutsui käyttäjän %{who} %{when}","invited_group":"kutsui käyttäjän %{who} %{when}","user_left":"%{who} poisti itsensä tästä yksityiskeskustelusta %{when}","removed_user":"poisti käyttäjän %{who} %{when}","removed_group":"poisti käyttäjän %{who} %{when}","autobumped":"nousi automaattisesti %{when}","autoclosed":{"enabled":"sulki %{when}","disabled":"avasi %{when}"},"closed":{"enabled":"sulki %{when}","disabled":"avasi %{when}"},"archived":{"enabled":"arkistoi %{when}","disabled":"palautti %{when}"},"pinned":{"enabled":"kiinnitti %{when}","disabled":"poisti kiinnityksen %{when}"},"pinned_globally":{"enabled":"kiinnitti koko palstalle %{when}","disabled":"poisti kiinnityksen %{when}"},"visible":{"enabled":"listasi %{when}","disabled":"poisti listauksista %{when}"},"banner":{"enabled":"teki tästä bannerin %{when}. Se näytetään jokaisen sivun ylälaidassa, kunnes käyttäjä kuittaa sen nähdyksi.","disabled":"poisti tämän bannerin %{when}. Sitä ei enää näytetä jokaisen sivun ylälaidassa."},"forwarded":"välitti yllä olevan sähköpostin"},"topic_admin_menu":"ketjun työkalut","wizard_required":"Tervetuloa uuteen Discourseesi! Aloitetaan \u003ca href='%{url}' data-auto-route='true'\u003eohjattu asennus\u003c/a\u003e ✨","emails_are_disabled":"Ylläpitäjä on estänyt kaiken lähtevän sähköpostiliikenteen. Mitään sähköposti-ilmoituksia ei lähetetä.","bootstrap_mode_enabled":"Jotta uuden palstan vauhtiin saaminen olisi helpompaa, sivusto on aloitustilassa. Kaikki uudet käyttäjät saavat luottamustason 1 ja heille lähetetään sähköpostitiivistelmät päivittäin. Tila poistetaan automaattisesti, kun %{min_users} käyttäjää on liittynyt.","bootstrap_mode_disabled":"Aloitustila poistetaan seuraavan 24 tunnin aikana.","themes":{"default_description":"Oletus","broken_theme_alert":"Teemassa / komponentissa %{theme} on virheitä, jotka voivat aiheuttaa sen, ettei sivustosi toimi. Voit ottaa sen käytöstä täällä: %{path}."},"s3":{"regions":{"ap_northeast_1":"Aasia ja Tyynimeri (Tokio)","ap_northeast_2":"Aasia ja Tyynimeri (Soul)","ap_south_1":"Aasia ja Tyynimeri (Mumbai)","ap_southeast_1":"Aasia ja Tyynimeri (Singapore)","ap_southeast_2":"Aasia ja Tyynimeri (Sydney)","ca_central_1":"Kanada (keskinen)","cn_north_1":"Kiina (Peking)","cn_northwest_1":"Kiina (Ningxia)","eu_central_1":"EU (Frankfurt)","eu_north_1":"EU (Tukholma)","eu_west_1":"EU (Irlanti)","eu_west_2":"EU (Lontoo)","eu_west_3":"EU (Pariisi)","sa_east_1":"Etelä-Amerikka (São Paulo)","us_east_1":"itäinen USA (Pohjois-Virginia)","us_east_2":"Itäinen USA (Ohio)","us_gov_east_1":"AWS GovCloud (itäinen USA)","us_gov_west_1":"AWS GovCloud (läntinen USA)","us_west_1":"Läntinen USA (Pohjois-Kalifornia)","us_west_2":"Läntinen USA (Oregon)"}},"edit":"muokkaa ketjun otsikkoa ja aluetta","expand":"Laajenna","not_implemented":"Tätä toimintoa ei ole vielä toteutettu, pahoittelut!","no_value":"Ei","yes_value":"Kyllä","submit":"Lähetä","generic_error":"On tapahtunut virhe.","generic_error_with_reason":"Tapahtui virhe: %{error}","go_ahead":"Jatka","sign_up":"Luo tili","log_in":"Kirjaudu","age":"Ikä","joined":"Liittynyt","admin_title":"Ylläpito","show_more":"näytä lisää","show_help":"valinnat","links":"Linkit","links_lowercase":{"one":"linkki","other":"linkit"},"faq":"UKK","guidelines":"Ohjeet","privacy_policy":"Tietosuojaseloste","privacy":"Tietosuoja","tos":"Käyttöehdot","rules":"Säännöt","conduct":"Käytössäännöt","mobile_view":"Mobiilinäkymä","desktop_view":"Työpöytänäkymä","you":"Sinä","or":"tai","now":"juuri äsken","read_more":"lue lisää","more":"Lisää","less":"Vähemmän","never":"ei koskaan","every_30_minutes":"puolen tunnin välein","every_hour":"tunnin välein","daily":"päivittäin","weekly":"viikottain","every_month":"kuukausittain","every_six_months":"puolen vuoden välein","max_of_count":"korkeintaan {{count}}","alternation":"tai","character_count":{"one":"{{count}} merkki","other":"{{count}} merkkiä"},"related_messages":{"title":"Aiheeseen liittyviä keskusteluja","see_all":"Katso \u003ca href=\"%{path}\"\u003ekaikki viestit\u003c/a\u003e käyttäjältä @%{username}..."},"suggested_topics":{"title":"Ketjuehdotuksia","pm_title":"Keskusteluehdotuksia"},"about":{"simple_title":"Tietoja","title":"Tietoja sivustosta %{title}","stats":"Sivuston tilastot","our_admins":"Ylläpitäjät","our_moderators":"Valvojat","moderators":"Valvojat","stat":{"all_time":"Yhteensä","last_7_days":"Viimeiset 7","last_30_days":"Viimeiset 30"},"like_count":"Tykkäyksiä","topic_count":"Ketjuja","post_count":"Viestejä","user_count":"Käyttäjät","active_user_count":"Aktiivisia käyttäjiä","contact":"Yhteystiedot","contact_info":"Sivustoon liittyvissä kiireellisissä asioissa, ota yhteyttä osoitteeseen %{contact_info}."},"bookmarked":{"title":"Kirjanmerkki","clear_bookmarks":"Tyhjennä kirjanmerkit","help":{"bookmark":"Klikkaa lisätäksesi ketjun ensimmäisen viestin kirjanmerkkeihin","unbookmark":"Klikkaa poistaaksesi kaikki tämän ketjun kirjanmerkit"}},"bookmarks":{"created":"olet lisännyt tämän viestin kirjanmerkkeihisi","not_bookmarked":"lisää viesti kirjanmerkkeihin","created_with_at_desktop_reminder":"kirjanmerkitsit tämän viestin ja sinua muistutetaan siitä kun seuraavan kerran olet työpöytäympäristössäsi","remove":"Poista kirjanmerkki","confirm_clear":"Haluatko varmasti poistaa kaikki kirjanmerkkisi tästä ketjusta?","save":"Tallenna","no_timezone":"Et ole valinnut aikavyöhykettä, joten et voi asettaa muistutuksia. Aseta se  \u003ca href=\"%{basePath}/my/preferences/profile\"\u003eprofiilisivullasi\u003c/a\u003e.","invalid_custom_datetime":"Antamasi päivämäärä ja kellonaika ei kelpaa, yritä uudelleen.","list_permission_denied":"Et voi nähdä tämän käyttäjän kirjanmerkkejä.","reminders":{"at_desktop":"Ensi kerralla kun olen työpöytäympäristössäni","later_today":"Myöhemmin tänään","next_business_day":"Seuraavana arkipäivänä","tomorrow":"Huomenna","next_week":"Ensi viikolla","later_this_week":"Myöhemmin tällä viikolla","next_month":"Ensi kuussa","custom":"Valitse päivämäärä ja kellonaika","none":"Muistutus ei tarpeen"}},"drafts":{"resume":"Jatka","remove":"Poista","new_topic":"Uusi ketjuluonnos","new_private_message":"Uusi yksityisviestiluonnos","topic_reply":"Vastausluonnos","abandon":{"confirm":"Sinulla on keskeneräinen luonnos tässä ketjussa. Haluatko varmasti hylätä sen?","yes_value":"Kyllä, hylkään","no_value":"Ei, säilytän"}},"topic_count_latest":{"one":"Katso {{count}} uusi tai päivittynyt ketju","other":"Katso {{count}} uutta tai päivittynyttä ketjua"},"topic_count_unread":{"one":"Näytä {{count}} lukematon ketju","other":"Näytä {{count}} lukematonta ketjua"},"topic_count_new":{"one":"Näytä {{count}} uusi ketju","other":"Näytä {{count}} uutta ketjua"},"preview":"esikatselu","cancel":"peruuta","save":"Tallenna muutokset","saving":"Tallennetaan...","saved":"Tallennettu!","upload":"Liitä","uploading":"Lähettää...","uploading_filename":"Ladataan: {{filename}}","clipboard":"leikepöytä","uploaded":"Lähetetty!","pasting":"Liitetään...","enable":"Ota käyttöön","disable":"Poista käytöstä","continue":"Jatka","undo":"Peru","revert":"Palauta","failed":"Epäonnistui","switch_to_anon":"Siirry anonyymitilaan","switch_from_anon":"Poistu anonyymitilasta","banner":{"close":"Sulje tämä banneri.","edit":"Muokkaa banneria \u003e\u003e"},"pwa":{"install_banner":"Haluatko \u003ca href\u003easentaa sivuston %{title} tälle laitteelle?\u003c/a\u003e"},"choose_topic":{"none_found":"Yhtään ketjua ei löydetty.","title":{"search":"Etsi ketjua","placeholder":"Syötä ketjun otsikko, url tai id tähän"}},"choose_message":{"none_found":"Keskusteluja ei löytynyt.","title":{"search":"Etsi yksityiskeskustelua","placeholder":"Syötä keskustelun otsikko, url tai id tähän"}},"review":{"order_by":"Järjestä","in_reply_to":"vastauksena","explain":{"why":"selitä miksi tämä päätyi jonoon","title":"Käsittelypisteytys","formula":"Kaava","subtotal":"Välisumma","total":"Yhteensä","min_score_visibility":"Näkymisen vähimmäispistemäärä","score_to_hide":"Pistemäärä, joka piilottaa viestin","take_action_bonus":{"name":"ryhtyi toimiin","title":"Kun henkilökunnnan jäsen ryhtyy toimiin, lippu saa bonuspisteitä."},"user_accuracy_bonus":{"name":"käyttäjän tarkkuus","title":"Käyttäjät joiden aiemmista lipuista on oltu samaa mieltä saavat bonuspisteitä."},"trust_level_bonus":{"name":"luottamustaso","title":"Korkeampien luottamustasojen käyttäjien luomat käsiteltävät saavat korkeammat pisteet."},"type_bonus":{"name":"tyyppibonus","title":"Tietylle käsiteltävälle lajityypille voi henkilökunta määritellä bonuksen, jotta ne saavat korkeamman prioriteetin."}},"claim_help":{"optional":"Voit vaatia tämän itsellesi, jolloin muut eivät voi käsitellä sitä.","required":"Sinun täytyy osoittaa asia itsellesi ennen kuin voit käsitellä sen.","claimed_by_you":"Osoitit tämän itsellesi ja voit nyt käsitellä sen.","claimed_by_other":"Tämän voi käsitellä vain \u003cb\u003e{{username}}\u003c/b\u003e."},"claim":{"title":"osoita ketju itsellesi"},"unclaim":{"help":"peru osoitus"},"awaiting_approval":"Odottaa hyväksyntä","delete":"Poista","settings":{"saved":"Tallennettu","save_changes":"Tallenna muutokset","title":"Asetukset","priorities":{"title":"Käsittelyprioriteetit"}},"moderation_history":"Valvontahistoria","view_all":"Katso kaikki","grouped_by_topic":"Järjestetty ketjun mukaan","none":"Ei ole tarkastettavaa.","view_pending":"tarkastele jonoa","topic_has_pending":{"one":"\u003cb\u003e%{count}\u003c/b\u003e viesti tähän ketjuun odottaa hyväksyntää","other":"\u003cb\u003e{{count}}\u003c/b\u003e viestiä tähän ketjuun odottaa hyväksyntää"},"title":"Käsittele","topic":"Ketju:","filtered_topic":"Olet suodattanut käsiteltävän sisällön yhdestä ketjusta.","filtered_user":"Käyttäjä","show_all_topics":"näytä kaikki ketjut","deleted_post":"(viesti poistettu)","deleted_user":"(käyttäjä poistettu)","user":{"bio":"Käyttäjätiedot","website":"Nettisivu","username":"Käyttäjätunnus","email":"Sähköposti","name":"Nimi","fields":"Kentät"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} lippu kaikkiaan)","other":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} lippua kaikkiaan)"},"agreed":{"one":"{{count}}% samaa mieltä","other":"{{count}}% samaa mieltä"},"disagreed":{"one":"{{count}}% eri mieltä","other":"{{count}}% eri mieltä"},"ignored":{"one":"{{count}}% sivuutettu","other":"{{count}}% sivuutettu"}},"topics":{"topic":"Ketju","reviewable_count":"Lukumäärä","reported_by":"Ilmoittaja","deleted":"[Ketju poistettu]","original":"(alkuperäinen ketju)","details":"yksityiskohdat","unique_users":{"one":"%{count} käyttäjä","other":"{{count}} käyttäjää"}},"replies":{"one":"%{count} vastaus","other":"{{count}} vastausta"},"edit":"Muokkaa","save":"Tallenna","cancel":"Peru","new_topic":"Tämän hyväksyminen aloittaa uuden ketjun","filters":{"all_categories":"(kaikki alueet)","type":{"title":"Tyyppi","all":"(kaikki tyypit)"},"minimum_score":"Vähimmäispisteet:","refresh":"Lataa sivu uudelleen","status":"Tila","category":"Alue","orders":{"priority":"Prioriteetti","priority_asc":"Prioriteetti (käänteinen)","created_at":"Luotu","created_at_asc":"Luotu (käänteinen)"},"priority":{"title":"Vähimmäisprioriteetti","low":"(mikä tahansa)","medium":"Keskiverto","high":"Korkea"}},"conversation":{"view_full":"katso koko keskustel"},"scores":{"about":"Pisteet perustuvat ilmoittajan luottamustasoon, heidän aiempien liputusten osuvuuteen ja raportoidun asian prioriteettiin.","score":"Luku","date":"Päivämäärä","type":"Tyyppi","status":"Tila","submitted_by":"Lähettäjä","reviewed_by":"Käsittelijä"},"statuses":{"pending":{"title":"Odottaa"},"approved":{"title":"Hyväksytty"},"rejected":{"title":"Hylätyt"},"ignored":{"title":"Sivuutettu"},"deleted":{"title":"Poistett"},"reviewed":{"title":"(kaikki käsitellyt)"},"all":{"title":"(kaikki)"}},"types":{"reviewable_flagged_post":{"title":"Liputettu viesti","flagged_by":"Liputtaja"},"reviewable_queued_topic":{"title":"Jonossa oleva ketju"},"reviewable_queued_post":{"title":"Jonossa oleva viesti"},"reviewable_user":{"title":"Käyttäjä"}},"approval":{"title":"Viesti odottaa hyväksyntää","description":"Viestisi saapui perille, mutta valvojan on vielä hyväksyttävä se, jotta se näkyy sivustolla. Ole kärsivällinen.","pending_posts":{"one":"Jonossa on \u003cstrong\u003e%{count}\u003c/strong\u003e viesti.","other":"Jonossa on \u003cstrong\u003e{{count}}\u003c/strong\u003e viestiä."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e kirjoitti \u003ca href='{{topicUrl}}'\u003eketjuun\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eSinä\u003c/a\u003e kirjoitit \u003ca href='{{topicUrl}}'\u003eketjuun\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e vastasi \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eSinä\u003c/a\u003e vastasit \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e vastasi \u003ca href='{{topicUrl}}'\u003eketjuun\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eSinä\u003c/a\u003e vastasit \u003ca href='{{topicUrl}}'\u003eketjuun\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mainitsi käyttäjän \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mainitsi \u003ca href='{{user2Url}}'\u003esinut\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eSinä\u003c/a\u003e mainitsit käyttäjän \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Kirjoittaja \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Kirjoittaja \u003ca href='{{userUrl}}'\u003esinä\u003c/a\u003e","sent_by_user":"Lähettäjä \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Lähettäjä \u003ca href='{{userUrl}}'\u003esinä\u003c/a\u003e"},"directory":{"filter_name":"suodata tunnuksen perusteella","title":"Käyttäjät","likes_given":"Annetut","likes_received":"Saadut","topics_entered":"Katsellut","topics_entered_long":"Katseltuja ketjuja","time_read":"Lukuaika","topic_count":"Ketjut","topic_count_long":"Ketjunaloituksia","post_count":"Vastauksia","post_count_long":"Kirjoitettuja vastauksia","no_results":"Ei tuloksia.","days_visited":"Vierailut","days_visited_long":"Päiviä vierailtu","posts_read":"Luetut","posts_read_long":"Luettuja viestejä","total_rows":{"one":"%{count} käyttäjä","other":"%{count} käyttäjää"}},"group_histories":{"actions":{"change_group_setting":"Muuta ryhmän asetusta","add_user_to_group":"Lisää käyttäjä","remove_user_from_group":"Poista käyttäjä","make_user_group_owner":"Myönnä isännyys","remove_user_as_group_owner":"Peru isännyys"}},"groups":{"member_added":"Lisättiin","member_requested":"Pyyntö ryhmässä","add_members":{"title":"Lisää jäseniä","description":"Hallinnoi ryhmän jäsenyyksiä","usernames":"Käyttäjänimet"},"requests":{"title":"Pyynnöt","reason":"Syy","accept":"Hyväksy","accepted":"hyväksyi","deny":"Hylkää","denied":"hylättiin","undone":"pyyntö peruttu","handle":"käsittele jäsenyyshakemus"},"manage":{"title":"Hallinnoi","name":"Nimi","full_name":"Täysmittainen nimi","add_members":"Lisää jäseniä","delete_member_confirm":"Poista '%{username}' ryhmästä '%{group}'?","profile":{"title":"Profiili"},"interaction":{"title":"Vuorovaikutus","posting":"Kirjoittaminen","notification":"Ilmoitus"},"membership":{"title":"Jäsenyys","access":"Pääsy"},"logs":{"title":"Lokit","when":"Milloin","action":"Toimi","acting_user":"Toimija","target_user":"Kohdekäyttäjä","subject":"Aihe","details":"Yksityiskohdat","from":"Mistä","to":"Minne"}},"public_admission":"Salli käyttäjien liittyä ryhmään vapaasti (Ryhmän täytyy olla julkinen)","public_exit":"Salli käyttäjien poistua ryhmästä vapaasti","empty":{"posts":"Ryhmän jäsenet eivät ole lähettäneet viestejä.","members":"Ryhmässä ei ole jäseniä.","requests":"Ryhmään ei ole hakemuksia.","mentions":"Ryhmää ei ole mainittu.","messages":"Ryhmälle ei ole yksityisviestejä.","topics":"Ryhmän jäsenet eivät ole aloittaneet ketjuja.","logs":"Ryhmälle ei ole lokitietoja."},"add":"Lisää","join":"Liity","leave":"Poistu","request":"Pyyntö","message":"Viesti","confirm_leave":"Haluatko varmasti poistua ryhmästä?","allow_membership_requests":"Salli käyttäjän lähettää jäsenhakemuksia ryhmien isännille (Vaatii sen, että ryhmä on julkinen)","membership_request_template":"Viestipohja, joka näytetään käyttäjälle, kun hän lähettää jäsenhakemusta ryhmään.","membership_request":{"submit":"Lähetä hakemus","title":"Hakemus ryhmään @%{group_name}","reason":"Kerro ryhmän isännille, miksi haluat kuulua tähän ryhmään"},"membership":"Jäsenyys","name":"Nimi","group_name":"Ryhmän nimi","user_count":"Käyttäjät","bio":"Tietoa ryhmästä","selector_placeholder":"syötä käyttäjänimi","owner":"isäntä","index":{"title":"Ryhmät","all":"Kaikki ryhmät","empty":"Näkyvillä olevia ryhmiä ei ole.","filter":"Suodata ryhmän tyypin mukaan","owner_groups":"Ryhmät joita isännöin","close_groups":"Suljetut ryhmät","automatic_groups":"Automaattiset ryhmät","automatic":"Automaattinen","closed":"Suljettu","public":"Julkinen","private":"Yksityinen","public_groups":"Julkiset ryhmät","automatic_group":"Automaattinen ryhmä","close_group":"Sulje ryhmä","my_groups":"Minun ryhmäni","group_type":"Ryhmän tyyppi","is_group_user":"Jäsen","is_group_owner":"Isäntä"},"title":{"one":"Ryhmä","other":"Ryhmät"},"activity":"Toiminta","members":{"title":"Jäsenet","filter_placeholder_admin":"käyttäjänimi tai sähköposti","filter_placeholder":"käyttäjänimi","remove_member":"Poista jäsen","remove_member_description":"Poista \u003cb\u003e%{username}\u003c/b\u003e ryhmästä","make_owner":"Myönnä isännyys","make_owner_description":"Tee käyttäjästä \u003cb\u003e%{username}\u003c/b\u003e ryhmän isäntä","remove_owner":"Peru isännyys","remove_owner_description":"Peru käyttäjältä \u003cb\u003e%{username}\u003c/b\u003e ryhmän isännyys","owner":"Isäntä","forbidden":"Et voi tarkastella jäseniä."},"topics":"Ketjut","posts":"Viestit","mentions":"Maininnat","messages":"Viestit","notification_level":"Ryhmäviestien oletusilmoitusasetus","alias_levels":{"mentionable":"Ketkä voivat @mainita ryhmän?","messageable":"Ketkä voivat lähettää ryhmälle viestin?","nobody":"Ei kukaan","only_admins":"Vain ylläpitäjät","mods_and_admins":"Vain ylläpitäjät ja valvojat","members_mods_and_admins":"Vain ryhmän jäsenet, valvojat ja ylläpitäjät","owners_mods_and_admins":"Vain ryhmän isännät, valvojat ja ylläpito","everyone":"Kaikki"},"notifications":{"watching":{"title":"Tarkkailussa","description":"Saat ilmoituksen uusista viesteistä jokaisessa viestiketjussa, ja uusien vastausten lukumäärä näytetään."},"watching_first_post":{"title":"Uudet ketjut tarkkailussa","description":"Saat ilmoituksen uusista ryhmän yksityisviestiketjuista, muttet vastauksista niihin."},"tracking":{"title":"Seurannassa","description":"Saat ilmoituksen, jos joku mainitsee @nimesi tai vastaa sinulle, ja uusien vastausten lukumäärä näytetään."},"regular":{"title":"Tavallinen","description":"Saat ilmoituksen, jos joku mainitsee @nimesi tai vastaa sinulle."},"muted":{"title":"Vaimennettu","description":"Et saa ilmoituksia ryhmän yksityiskeskusteluista."}},"flair_url":"Avatarpinssin kuva","flair_url_placeholder":"(Ei-pakollinen) kuvan URL tai Font Awesome -luokka","flair_url_description":"Käytä neliönmuotoista, kooltaan vähintään 20px kertaa 20px kuvaa tai FontAwesome ikonia (hyväksytyt muodot: \"fa-icon\", \"far fa-icon\" tai \"fab fa-icon\").","flair_bg_color":"Avatar-pinssin taustaväri","flair_bg_color_placeholder":"(Ei-pakollinen) värin Hex-arvo","flair_color":"Avatarpinssin väri","flair_color_placeholder":"(Ei-pakollinen) värin Hex-arvo","flair_preview_icon":"Ikonin esikatselu","flair_preview_image":"Kuvan esikatselu"},"user_action_groups":{"1":"Annetut tykkäykset","2":"Saadut tykkäykset","3":"Kirjanmerkit","4":"Ketjut","5":"Vastaukset","6":"Vastaukset","7":"Maininnat","9":"Lainaukset","11":"Muokkaukset","12":"Lähetetyt","13":"Postilaatikko","14":"Odottaa","15":"Luonnokset"},"categories":{"all":"kaikki alueet","all_subcategories":"kaikki","no_subcategory":"vain pääalue","category":"Alue","category_list":"Näytä alueet","reorder":{"title":"Järjestä alueet uudelleen","title_long":"Järjestä alueiden lista uudelleen","save":"Tallenna järjestys","apply_all":"Aseta","position":"Paikka"},"posts":"Viestit","topics":"Ketjut","latest":"Tuoreimmat","latest_by":"tuorein","toggle_ordering":"vaihda järjestystä","subcategories":"Tytäralueet","topic_sentence":{"one":"%{count} ketju","other":"%{count} ketjua"},"topic_stat_sentence_week":{"one":"%{count} uusi ketju viimeisimmän viikon aikana","other":"%{count} uutta ketjua viimeisimmän viikon aikana"},"topic_stat_sentence_month":{"one":"%{count} uusi ketju viimeisimmän kuukauden aikana","other":"%{count} uutta ketjua viimeisimmän kuukauden aikana"},"n_more":"Alueet (%{count} muuta)..."},"ip_lookup":{"title":"IP-osoitteen haku","hostname":"Isäntänimi","location":"Sijainti","location_not_found":"(tuntematon)","organisation":"Yritys","phone":"Puhelin","other_accounts":"Muut tilit samasta IP-osoitteesta:","delete_other_accounts":"Poista %{count}","username":"käyttäjätunnus","trust_level":"LT","read_time":"lukuaika","topics_entered":"katseltuja ketjuja","post_count":"# viestiä","confirm_delete_other_accounts":"Oletko varma, että haluat poistaa nämä tunnukset?","powered_by":"\u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e:n avulla","copied":"kopioitu"},"user_fields":{"none":"(valitse vaihtoehto)"},"user":{"said":"{{username}}:","profile":"Profiili","mute":"Vaimenna","edit":"Muokkaa asetuksia","download_archive":{"button_text":"Lataa kaikki","confirm":"Haluatko varmasti ladata viestisi?","success":"Lataus aloitettu. Saat ilmoituksen yksityisviestinä, kun prosessi on valmis.","rate_limit_error":"Viestit voi ladata kerran vuorokaudessa. Yritä huomenna uudelleen."},"new_private_message":"Uusi viesti","private_message":"Viesti","private_messages":"Viestit","user_notifications":{"ignore_duration_title":"Estoajastin","ignore_duration_username":"Käyttäjätunnus","ignore_duration_when":"Kesto:","ignore_duration_save":"Sivuuta","ignore_duration_note":"Huomioi että estot poistuvat automaattisesti, kun estolle määritelty kesto umpeutuu.","ignore_duration_time_frame_required":"Valitse ajanjakso","ignore_no_users":"Et ole estänyt ketään.","ignore_option":"Sivuutettu","ignore_option_title":"Et saa käyttäjään liittyviä ilmoituksia ja kaikki hänen aloittamansa ketjut ja vastaukset piilotetaan.","add_ignored_user":"Lisää...","mute_option":"Vaimenna","mute_option_title":"Et saa käyttäjään liittyviä ilmoituksia.","normal_option":"Normaali","normal_option_title":"Saat ilmoituksen jos käyttäjä vastaa sinulle, lainaa sinua tai mainitsee sinut."},"activity_stream":"Toiminta","preferences":"Asetukset","feature_topic_on_profile":{"open_search":"Valitse uusi ketju","title":"Valitse ketju","search_label":"Etsi ketjua nimellä","save":"Tallenna","clear":{"title":"Tyhjennä","warning":"Haluatko varmasti nollata valikoimasi ketjun?"}},"profile_hidden":"Käyttäjän julkinen profiili ei ole nähtävillä.","expand_profile":"Laajenna","collapse_profile":"Supista","bookmarks":"Kirjanmerkit","bio":"Tietoa minusta","timezone":"Aikavyöhyke","invited_by":"Kutsuja","trust_level":"Luottamustaso","notifications":"Ilmoitukset","statistics":"Tilastot","desktop_notifications":{"label":"Live-ilmoitukset","not_supported":"Tämä selain ei tue ilmoituksia, pahoittelut.","perm_default":"Näytä ilmoituksia","perm_denied_btn":"Ei oikeuksia","perm_denied_expl":"Olet kieltänyt ilmoitukset. Salli ilmoitukset selaimesi asetuksista.","disable":"Poista ilmoitukset käytöstä","enable":"Näytä ilmoituksia","each_browser_note":"Huom: Asetus on säädettävä erikseen jokaisessa selaimessa, jota käytät.","consent_prompt":"Haluatko liveilmoituksia kun muut vastaavat viesteihisi?"},"dismiss":"Unohda","dismiss_notifications":"Unohda kaikki","dismiss_notifications_tooltip":"Merkitse kaikki lukemattomat ilmoitukset luetuiksi","first_notification":"Ensimmäinen ilmoitus sinulle! Valitse se niin aloitetaan.","dynamic_favicon":"Näytä määriä selainkuvakkeessa","theme_default_on_all_devices":"Tee tästä oletusteema kaikille laitteilleni","text_size_default_on_all_devices":"Tee tästä oletusfonttikoko kaikille laitteilleni","allow_private_messages":"Salli toisten käyttäjien lähettää minulle yksityisviestejä","external_links_in_new_tab":"Avaa sivuston ulkopuoliset linkit uudessa välilehdessä","enable_quoting":"Ota käyttöön viestin lainaaminen tekstiä valitsemalla","enable_defer":"Ota käyttöön lykkäystoiminto, jolla voi merkitä ketjun lukemattomaksi","change":"vaihda","featured_topic":"Valikoitu ketju","moderator":"{{user}} on valvoja","admin":"{{user}} on ylläpitäjä","moderator_tooltip":"Tämä käyttäjä on valvoja","admin_tooltip":"Tämä käyttäjä on ylläpitäjä","silenced_tooltip":"Käyttäjä on hiljennetty","suspended_notice":"Tämä käyttäjätili on hyllytetty {{date}} asti.","suspended_permanently":"Käyttäjä on hyllytetty.","suspended_reason":"Syy:","github_profile":"GitHub","email_activity_summary":"Kooste tapahtumista","mailing_list_mode":{"label":"Postituslistatila","enabled":"Ota käyttöön postituslistatila","instructions":"Asetus syrjäyttää koosteet tapahtumista.\u003cbr /\u003e\nVaimennettujen ketjujen ja alueiden viestejä ei sisällytetä sähköposteihin.\n","individual":"Lähetä sähköpostia jokaisesta uudesta viestistä","individual_no_echo":"Lähetä sähköposti jokaisesta uudesta viestistä lukuun ottamatta omiani","many_per_day":"Lähetä minulle sähköpostia jokaisesta uudesta viestistä (noin {{dailyEmailEstimate}} päivässä)","few_per_day":"Lähetä minulle sähköpostia jokaisesta uudesta viestistä (noin 2 päivässä)","warning":"Postituslistatila käytössä. Sähköposti-ilmoitusasetukset syrjäytetty."},"tag_settings":"Tunnisteet","watched_tags":"Tarkkailtavat","watched_tags_instructions":"Ketjut joilla on joku näistä tunnisteista asetetaan automaattisesti tarkkailuun. Saat ilmoituksen kaikista uusista viesteistä ja ketjuista, ja uusien viestien lukumäärä näytetään ketjun otsikon vieressä. ","tracked_tags":"Seurattavat","tracked_tags_instructions":"Ketjut, joilla on joku näistä tunnisteista, asetetaan automaattisesti seurantaan. Uusien viestien lukumäärä näytetään ketjun otsikon vieressä. ","muted_tags":"Vaimennettavat","muted_tags_instructions":"Et saa ilmoituksia ketjuista, joilla on joku näistä tunnisteista, eivätkä ne näy tuoreimmissa.","watched_categories":"Tarkkaillut","watched_categories_instructions":"Näiden alueiden kaikki uudet ketjut asetetaan automaattisesti tarkkailuun. Saat ilmoituksen kaikista uusista viesteistä ja ketjuista, ja uusien viestien lukumäärä näytetään ketjun otsikon vieressä. ","tracked_categories":"Seuratut","tracked_categories_instructions":"Näiden alueiden ketjut asetetaan automaattisesti seurantaan. Uusien viestien lukumäärä näytetään ketjun yhteydessä.","watched_first_post_categories":"Tarkkaillaan uusia ketjuja","watched_first_post_categories_instructions":"Saat ilmoituksen näiden alueiden ketjujen ensimmäisistä viesteistä.","watched_first_post_tags":"Tarkkaillaan uusia ketjuja","watched_first_post_tags_instructions":"Saat ilmoituksen uusista ketjuista, joilla on joku näistä tunnisteista.","muted_categories":"Vaimennetut","muted_categories_instructions":"Et saa minkäänlaisia ilmoituksia näille alueille luoduista uusista ketjuista. Ketjut eivät näy aluelistauksissa eivätkä tuoreimmissa.","muted_categories_instructions_dont_hide":"Et saa ilmoituksia mistään tämän alueen uusiin ketjuihin liittyvästä.","no_category_access":"Valvojana sinulla on rajoitetut oikeudet alueisiin, et voi tallentaa.","delete_account":"Poista tilini","delete_account_confirm":"Oletko varma, että haluat lopullisesti poistaa käyttäjätilisi? Tätä toimintoa ei voi perua!","deleted_yourself":"Käyttäjätilisi on poistettu.","delete_yourself_not_allowed":"Ota yhteyttä henkilökuntaan jos haluat että tilisi poistetaan.","unread_message_count":"Viestit","admin_delete":"Poista","users":"Käyttäjät","muted_users":"Vaimennetut","muted_users_instructions":"Älä näytä ilmoituksia näiltä käyttäjiltä","ignored_users":"Sivuutettu","ignored_users_instructions":"Jätä näyttämättä kaikki viestit ja ilmoitukset näiltä käyttäjiltä.","tracked_topics_link":"Näytä","automatically_unpin_topics":"Poista kiinnitetyn ketjun kiinnitys automaattisesti, kun olen selannut sen loppuun.","apps":"Sovellukset","revoke_access":"Peru käyttöoikeus","undo_revoke_access":"Peru käyttöoikeuden peruminen","api_approved":"Sallittu:","api_last_used_at":"Viimeksi käytetty:","theme":"Teema","home":"Oletusnäkymä","staged":"Esikäyttäjä","staff_counters":{"flags_given":"hyödyllistä liputusta","flagged_posts":"liputettua viestiä","deleted_posts":"poistettua viestiä","suspensions":"hyllytyksiä","warnings_received":"varoituksia","rejected_posts":"hylättyjä viestejä"},"messages":{"all":"Kaikki","inbox":"Saapuneet","sent":"Lähetetyt","archive":"Arkisto","groups":"Omat ryhmäni","bulk_select":"Valitse viestejä","move_to_inbox":"Siirrä saapuneisiin","move_to_archive":"Arkisto","failed_to_move":"Viestien siirto epäonnistui (vika saattaa olla internetyhteydessäsi)","select_all":"Valitse kaikki","tags":"Tunnisteet"},"preferences_nav":{"account":"Tili","profile":"Profiili","emails":"Sähköpostit","notifications":"Ilmoitukset","categories":"Alueet","users":"Käyttäjät","tags":"Tunnisteet","interface":"Käyttöliittymä","apps":"Sovellukset"},"change_password":{"success":"(sähköposti lähetetty)","in_progress":"(lähettää sähköpostia)","error":"(virhe)","action":"Lähetä sähköposti salasanan uusimista varten","set_password":"Aseta salasana","choose_new":"Valitse uusi salasana","choose":"Valitse salasana"},"second_factor_backup":{"title":"Kaksivaiheisen tunnistautumisen koodit","regenerate":"Tee uusi","disable":"Poista käytöstä","enable":"Ota käyttöön","enable_long":"Ota varakoodit käyttöön","manage":"Hallinnoi varakoodeja.. \u003cstrong\u003e{{count}}\u003c/strong\u003e varakoodia on jäljellä.","copied_to_clipboard":"Kopioitiin leikepöydälle","copy_to_clipboard_error":"Virhe kopioimisessa leikepöydälle","remaining_codes":"Sinulla on \u003cstrong\u003e{{count}}\u003c/strong\u003e varakoodia jäljellä.","use":"Käytä varakoodi","enable_prerequisites":"Ensisijainen metodi, kaksivaiheinen tunnistautuminen täytyy ottaa käyttöön ennen varakoodien luomista.","codes":{"title":"Varakoodit luotiin","description":"Jokaista näistä varakoodeista voi käyttää vain kerran. Säilö ne johonkin turvalliseen paikkaan, mistä kuitenkin löydät ne."}},"second_factor":{"title":"Kaksivaiheinen tunnistautuminen","enable":"Hallitse kaksivaiheista tunnistautumista","forgot_password":"Unohditko salasanan?","confirm_password_description":"Jatka vahvistamalla salasanasi","name":"Nimi","label":"Koodi","rate_limit":"Odota hetki ennen toisen todennuskoodin tarjoamista.","enable_description":"Skannaa QR-koodi laitteellesi sopivalla sovelluksella (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) ja syötä todennuskoodi.\n","disable_description":"Syötä sovelluksen tarjoama tunnistautumiskoodi","show_key_description":"Syötä manuaalisesti","short_description":"Suojaa käyttäjätilisi kertakäyttöisillä turvakoodeilla.\n","extended_description":"Kaksivaiheinen tunnistautuminen lisää tilisi tietoturvaa vaatimalla kertakäyttöisen koodin salasanan lisäksi. Koodeja voi luoda \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid-\u003c/a\u003e ja \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e-laitteilla.\n","oauth_enabled_warning":"Huomioi, ettet voi kirjautua some-tilien avulla, jos kaksivaiheinen tunnistautuminen on käytössä.","use":"Käytä Authenticator-sovellusta","enforced_notice":"Kaksivaiheinen tunnistautuminen pitää ottaa käyttöön, jotta voi käyttää sivustoa.","disable":"poista käytöstä","disable_title":"Ota kaksivaiheinen tunnistautuminen käytöstä","disable_confirm":"Oletko varma, että haluat ottaa kaikki kaksivaiheiset tunnistautumismuodot käytöstä?","edit":"Muokkaa","edit_title":"Muokkaa kaksivaiheista tunnistautumista","edit_description":"Kaksivaiheisen tunnistautumisen nim","enable_security_key_description":"Kun sinulla on fyysinen tunnistautumislaite kätesi ulottuvilla klikkaa alla olevaa rekisteröitymisnappia.","totp":{"title":"Välineeseen perustuvat tunnistautumiset","add":"Uusi tunnistautumistapa","default_name":"Tunnistautumissovellukseni"},"security_key":{"register":"Rekisteröidy","title":"Turva-avaimet","add":"Rekisteröi tunnistautumislaite","default_name":"Päätunnistautumislaite","not_allowed_error":"Tunnistautumislaitteen rekisteröintiprosessi joko vanheni tai peruutettiin.","already_added_error":"Olet jo rekisteröinyt tämän tunnistautumislaitteen. Sitä ei tarvitse rekisteröidä uudelleen.","edit":"Muokkaa tunnistautumislaitetta","edit_description":"Tunnistautumislaitteen nimi","delete":"Poista"}},"change_about":{"title":"Muokkaa kuvaustasi","error":"Arvon muuttamisessa tapahtui virhe."},"change_username":{"title":"Vaihda käyttäjätunnus","confirm":"Oletko aivan varma että haluat vaihtaa käyttäjänimesi?","taken":"Pahoittelut, tuo nimi on jo käytössä.","invalid":"Käyttäjätunnus ei kelpaa. Siinä saa olla ainoastaan numeroita ja kirjaimia."},"change_email":{"title":"Vaihda sähköposti","taken":"Pahoittelut, tämä sähköpostiosoite ei ole saatavilla.","error":"Sähköpostiosoitteen vaihdossa tapahtui virhe. Ehkäpä sama sähköpostiosoite on jo käytössä?","success":"Annettuun osoitteeseen on lähetetty viesti. Seuraa sen ohjeita sähköpostiosoitteen varmentamiseksi.","success_staff":"Lähetimme sähköpostia nykyiseen osoitteeseesi. Noudata vahvistusohjeita."},"change_avatar":{"title":"Vaihda profiilikuvasi","letter_based":"Sivuston luoma profiilikuva","uploaded_avatar":"Oma kuva","uploaded_avatar_empty":"Lisää oma kuva","upload_title":"Lataa oma kuva","image_is_not_a_square":"Varoitus: olemme rajanneet kuvaasti; korkeus ja leveys eivät olleet samoja"},"change_profile_background":{"title":"Profiilin yläkuva","instructions":"Profiilin yläkuva keskitetään ja sen oletusleveys on 1110 px."},"change_card_background":{"title":"Käyttäjäkortin taustakuva","instructions":"Taustakuvan leveys on 590 pikseliä."},"change_featured_topic":{"title":"Valikoitu ketju","instructions":"Käyttäjäkorttiisi ja profiilisivullesi tulee linkki tähän ketjuun."},"email":{"title":"Sähköposti","primary":"Ensisijainen sähköpostiosoite","secondary":"Toissijaiset sähköpostiosoitteet","no_secondary":"Ei toissijaisia sähköpostiosoitteita","instructions":"Ei tule julkiseksi.","ok":"Lähetämme sinulle sähköpostin varmistukseksi.","invalid":"Sähköpostiosoite ei kelpaa.","authenticated":"{{provider}} on todentanut sähköpostiosoitteesi","frequency_immediately":"Saat sähköpostia välittömästi, jollet ole jo lukenut asiaa, jota sähköpostiviesti koskee.","frequency":{"one":"Lähetämme sähköpostia vain, jos emme ole nähneet sinua edellisen minuutin aikana.","other":"Lähetämme sähköpostia vain, jos emme ole nähneet sinua edellisen {{count}} minuutin aikana."}},"associated_accounts":{"title":"Liitetyt käyttäjätilit","connect":"Yhdistä","revoke":"Kumoa yhdistäminen","cancel":"Peru","not_connected":"(ei liitetty)","confirm_modal_title":"Yhdistä %{provider}-tili","confirm_description":{"account_specific":"%{provider}-tiliäsi \"%{account_description}\" käytetään tunnistautumiseen.","generic":"%{provider}-tiliäsi käytetään tunnistautumiseen."}},"name":{"title":"Nimi","instructions":"koko nimesi (ei pakollinen)","instructions_required":"Koko nimesi","too_short":"Nimesi on liian lyhyt","ok":"Nimesi vaikuttaa hyvältä"},"username":{"title":"Käyttäjätunnus","instructions":"uniikki, ei välilyöntejä, lyhyt","short_instructions":"Muut käyttäjät voivat viitata sinuun nimellä @{{username}}","available":"Käyttäjätunnus on vapaana","not_available":"Ei saatavilla. Kokeile {{suggestion}}?","not_available_no_suggestion":"Ei saatavilla","too_short":"Käyttäjätunnus on liian lyhyt","too_long":"Käyttäjätunnus on liian pitkä","checking":"Tarkistetaan käyttäjätunnusta...","prefilled":"Sähköposti vastaa tätä käyttäjänimeä"},"locale":{"title":"Käyttöliittymän kieli","instructions":"Käyttöliittymän kieli. Kieli vaihtuu sivun uudelleen lataamisen yhteydessä.","default":"(oletus)","any":"mikä tahansa"},"password_confirmation":{"title":"Salasana uudelleen"},"auth_tokens":{"title":"Viimeksi käytetyt laitteet","ip":"IP","details":"Yksityiskohdat","log_out_all":"Kirjaudu ulos kaikkialta","active":"aktiivinen nyt","not_you":"Et ole sinä?","show_all":"Näytä kaikki ({{count}})","show_few":"Näytä vähemmän","was_this_you":"Olitko sinä?","was_this_you_description":"Jos sisäänkirjautuja et ollut sinä, suosittelemme salasanan vaihtamista ja uloskirjautumista kaikilta laitteiltasi.","browser_and_device":"{{browser}} laitteella {{device}}","secure_account":"Turvaa käyttäjätilini","latest_post":"Kirjoitit viimeksi..."},"last_posted":"Viimeisin viesti","last_emailed":"Viimeksi lähetetty sähköpostitse","last_seen":"Nähty","created":"Liittynyt","log_out":"Kirjaudu ulos","location":"Sijainti","website":"Nettisivu","email_settings":"Sähköposti","hide_profile_and_presence":"Piilota julkinen profiilini ja läsnäolo-ominaisuudet","enable_physical_keyboard":"Ota käyttöön valmius iPadin fyysiselle näppäimistölle","text_size":{"title":"Tekstikoko","smaller":"Pienempi","normal":"Normaali","larger":"Suurempi","largest":"Suurin"},"title_count_mode":{"title":"Määrä, jonka taustalla olevan sivun otsikko näyttää:","notifications":"Uudet ilmoitukset","contextual":"Uusi sivusisältö"},"like_notification_frequency":{"title":"Ilmoita, kun viestistäni tykätään","always":"Aina","first_time_and_daily":"Ensimmäistä kertaa ja päivittäin","first_time":"Ensimmäistä kertaa","never":"Ei koskaan"},"email_previous_replies":{"title":"Liitä aiemmat vastaukset mukaan sähköpostin alaosaan","unless_emailed":"ellei aiemmin lähetetty","always":"aina","never":"ei koskaan"},"email_digests":{"title":"Kun en käy täällä, lähetä sähköpostiini kooste suosituista ketjuista ja vastauksista","every_30_minutes":"puolen tunnin välein","every_hour":"tunneittain","daily":"päivittäin","weekly":"viikottain","every_month":"kuukausittain","every_six_months":"puolen vuoden välein"},"email_level":{"title":"Lähetä minulle sähköposti, jos joku lainaa viestiäni, vastaa viestiini, maintsee @nimeni tai kutsuu minut viestiketjuun","always":"aina","only_when_away":"vain kun olen poissa","never":"ei koskaan"},"email_messages_level":"Lähetä minulle sähköposti, kun joku lähettää minulle viestin","include_tl0_in_digests":"Sisällytä uusien käyttäjien viestit sähköpostikoosteisiin","email_in_reply_to":"Liitä sähköpostiin lyhennelmä viestistä, johon vastataan","other_settings":"Muut","categories_settings":"Keskustelualueet","new_topic_duration":{"label":"Tulkitse ketju uudeksi, jos","not_viewed":"en ole avannut sitä vielä","last_here":"se on luotu edellisen käyntini jälkeen","after_1_day":"se on luotu päivän aikana","after_2_days":"se on luotu 2 päivän aikana","after_1_week":"se on luotu viikon aikana","after_2_weeks":"se on luotu 2 viikon aikana"},"auto_track_topics":"Seuraa automaattisesti ketjuja, jotka avaan","auto_track_options":{"never":"ei koskaan","immediately":"heti","after_30_seconds":"30 sekunnin jälkeen","after_1_minute":"1 minuutin jälkeen","after_2_minutes":"2 minuutin jälkeen","after_3_minutes":"3 minuutin jälkeen","after_4_minutes":"4 minuutin jälkeen","after_5_minutes":"5 minuutin jälkeen","after_10_minutes":"10 minuutin jälkeen"},"notification_level_when_replying":"Kun kirjoitan ketjuun, aseta se ","invited":{"search":"kirjoita etsiäksesi kutsuja...","title":"Kutsut","user":"Kutsuttu käyttäjä","sent":"Lähetettiin viimeksi","none":"Ei kutsuja, joita näyttää.","truncated":{"one":"Näytetään ensimmäinen kutsu.","other":"Näytetään ensimmäiset {{count}} kutsua."},"redeemed":"Hyväksytyt kutsut","redeemed_tab":"Hyväksytyt","redeemed_tab_with_count":"Hyväksytyt ({{count}})","redeemed_at":"Hyväksytty","pending":"Odottavat kutsut","pending_tab":"Odottavat","pending_tab_with_count":"Avoimet ({{count}})","topics_entered":"Avatut ketjut","posts_read_count":"Luetut viestit","expired":"Tämä kutsu on rauennut.","rescind":"Poista","rescinded":"Kutsu poistettu","rescind_all":"Poista kaikki vanhentuneet kutsut","rescinded_all":"Kaikki vanhentuneet kutsut poistettu!","rescind_all_confirm":"Haluatko varmasti poistaa kaikki vanhentuneet kutsut?","reinvite":"Lähetä kutsu uudestaan","reinvite_all":"Lähetä kaikki kutsut uudestaan","reinvite_all_confirm":"Haluatko varmasti lähettää kaikki kutsut uudelleen?","reinvited":"Kutsu lähetetty uudestaan","reinvited_all":"Kaikki kutsut lähetettiin uudestaan","time_read":"Lukuaika","days_visited":"Päiviä vierailtu","account_age_days":"Tilin ikä päivissä","create":"Lähetä kutsu","generate_link":"Kopioi kutsulinkki","link_generated":"Kutsulinkki luotiin onnistuneesti!","valid_for":"Kutsulinkki on käypä tälle sähköpostiosoitteelle: %{email}","bulk_invite":{"none":"Et ole kutsunut vielä ketään tänne. Voit lähettää yksittäisiä kutsuja tai kutsua joukon ihmisiä kerralla \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003elataamalla CSV-tiedoston\u003c/a\u003e.","text":"Lähetä massakutsu tiedostosta","success":"Tiedoston lähettäminen onnistui. Saat viestin, kun prosessi on valmis.","error":"Pahoittelut, tiedoston tulee olla CSV-muodossa.","confirmation_message":"Olet lähettämässä kutsun kaikkiin sähköpostiosoitteisiin, jotka lähettämässäsi tiedostossa on."}},"password":{"title":"Salasana","too_short":"Salasanasi on liian lyhyt.","common":"Annettu salasana on liian yleinen.","same_as_username":"Salasanasi on sama kuin käyttäjätunnuksesi.","same_as_email":"Salasanasi on sama kuin sähköpostisi.","ok":"Salasana vaikuttaa hyvältä.","instructions":"vähintään %{count} merkkiä."},"summary":{"title":"Yhteenveto","stats":"Tilastot","time_read":"lukenut palstaa","recent_time_read":"lukenut hiljattain","topic_count":{"one":"avattu ketju","other":"aloitettua ketjua"},"post_count":{"one":"kirjoitettu viesti","other":"kirjoitettua viestiä"},"likes_given":{"one":"annettu","other":"annettu"},"likes_received":{"one":"saatu","other":"saatu"},"days_visited":{"one":"päivänä vieraillut","other":"päivänä vieraillut"},"topics_entered":{"one":"ketjua lukenut","other":"ketjua lukenut"},"posts_read":{"one":"luettu viesti","other":"luettua viestiä"},"bookmark_count":{"one":"kirjanmerkki","other":"kirjanmerkkiä"},"top_replies":"Parhaat viestit","no_replies":"Ei vastauksia toistaiseksi.","more_replies":"Lisää viestejä","top_topics":"Parhaat ketjut","no_topics":"Ei avattuja ketjuja toistaiseksi.","more_topics":"Lisää ketjuja","top_badges":"Parhaat ansiomerkit","no_badges":"Ei ansiomerkkejä toistaiseksi.","more_badges":"Lisää ansiomerkkejä","top_links":"Suosituimmat linkit","no_links":"Ei linkkejä toistaiseksi.","most_liked_by":"Eniten tykkäyksiä saatu","most_liked_users":"Eniten tykkäyksiä annettu","most_replied_to_users":"Useimmin vastannut","no_likes":"Ei tykkäyksiä toistaiseksi.","top_categories":"Suositut alueet","topics":"Ketjut","replies":"Vastaukset"},"ip_address":{"title":"Viimeinen IP-osoite"},"registration_ip_address":{"title":"IP-osoite rekisteröityessä"},"avatar":{"title":"Profiilikuva","header_title":"profiili, viestit, kirjanmerkit ja asetukset"},"title":{"title":"Titteli","none":"(ei mitään)"},"primary_group":{"title":"Ensisijainen ryhmä","none":"(ei mitään)"},"filters":{"all":"Kaikki"},"stream":{"posted_by":"Viestin kirjoittaja","sent_by":"Lähettänyt","private_message":"viesti","the_topic":"ketju"}},"loading":"Lataa...","errors":{"prev_page":"yrittäessä ladata","reasons":{"network":"Verkkovirhe","server":"Palvelinvirhe","forbidden":"Pääsy estetty","unknown":"Virhe","not_found":"Sivua ei löytynyt"},"desc":{"network":"Tarkasta internetyhteytesi.","network_fixed":"Näyttäisi palanneen takaisin.","server":"Virhekoodi: {{status}}","forbidden":"Sinulla ei ole oikeutta katsoa tätä.","not_found":"Hups, ohjelma yritti ladata osoitteen, jota ei ole olemassa","unknown":"Jotain meni pieleen."},"buttons":{"back":"Mene takaisin","again":"Yritä uudestaan","fixed":"Lataa sivu"}},"modal":{"close":"sulje"},"close":"Sulje","assets_changed_confirm":"Sivustolla on tehty päivityksiä. Ladataanko uudelleen?","logout":"Sinut kirjattiin ulos.","refresh":"Lataa sivu uudelleen","read_only_mode":{"enabled":"Sivusto on vain luku -tilassa. Voit jatkaa selailua, mutta vastaaminen, tykkääminen ja muita toimintoja on toistaiseksi poissa käytöstä.","login_disabled":"Et voi kirjautua sisään, kun sivusto on vain luku -tilassa.","logout_disabled":"Et voi kirjautua ulos, kun sivusto on vain luku -tilassa."},"logs_error_rate_notice":{},"learn_more":"opi lisää...","all_time":"yhteensä","all_time_desc":"ketjuja aloitettu yhteensä","year":"vuosi","year_desc":"viimeisen 365 päivän aikana aloitetut ketjut","month":"kuukausi","month_desc":"viimeisen 30 päivän aikana aloitetut ketjut","week":"viikko","week_desc":"viimeisen 7 päivän aikana aloitetut ketjut","day":"päivä","first_post":"Ensimmäinen viesti","mute":"Vaienna","unmute":"Poista vaimennus","last_post":"Kirjoitti","time_read":"Lukenut","time_read_recently":"%{time_read} viime aikoina","time_read_tooltip":"%{time_read} lukenut kaikkiaan","time_read_recently_tooltip":"%{time_read} lukenut kaikkiaan (%{recent_time_read} edellisen 60 päivän aikana)","last_reply_lowercase":"edellinen vastaus","replies_lowercase":{"one":"vastaus","other":"vastauksia"},"signup_cta":{"sign_up":"Luo tili","hide_session":"Muistuta huomenna","hide_forever":"ei kiitos","hidden_for_session":"OK, kysyn huomenna uudestaan. Voit aina myös käyttää 'Kirjaudu sisään' -linkkiä luodaksesi tilin.","intro":"Hei! Vaikuttaa siltä, että olet pitänyt keskusteluista, muttet ole luonut käyttäjätiliä.","value_prop":"Kun luot tilin, muistamme mitä olet lukenut, jotta voit aina palata keskusteluissa takaisin oikeaan kohtaan. Saat myös ilmoituksia - palstalla näkyviä ja sähköpostiisi saapuvia - kun joku vastaa sinulle. Ja voit myös tykätä viesteistä. :heartbeat:"},"summary":{"enabled_description":"Tarkastelet tiivistelmää tästä ketjusta, sen mielenkiintoisimpia viestejä käyttäjien toiminnan perusteella.","description":"Vastauksia on \u003cb\u003e{{replyCount}}\u003c/b\u003e kpl.","description_time":"Vastauksia on \u003cb\u003e{{replyCount}}\u003c/b\u003e. Niiden lukemiseen menee arviolta \u003cb\u003e{{readingTime}} minuuttia\u003c/b\u003e.","enable":"Näytä ketjun tiivistelmä","disable":"Näytä kaikki viestit"},"deleted_filter":{"enabled_description":"Tämä ketju sisältää poistettuja viestejä, jotka on piilotettu.","disabled_description":"Näytetään myös poistetut viestit.","enable":"Piilota poistetut viestit","disable":"Näytä poistetut viestit"},"private_message_info":{"title":"Viesti","invite":"Kutsu muita...","edit":"Lisää tai poista...","leave_message":"Haluatko varmasti poistua yksityiskeskustelusta?","remove_allowed_user":"Haluatko varmasti poistaa käyttäjän {{name}} tästä keskustelusta?","remove_allowed_group":"Haluatko varmasti poistaa käyttäjän {{name}} tästä viestiketjusta?"},"email":"Sähköposti","username":"Käyttäjätunnus","last_seen":"Nähty","created":"Luotu","created_lowercase":"luotu","trust_level":"Luottamustaso","search_hint":"käyttäjätunnus, sähköposti tai IP-osoite","create_account":{"disclaimer":"Kun rekisteröidyt, hyväksyt \u003ca href='{{privacy_link}}' target='blank'\u003etietosuojaselosteen\u003c/a\u003e ja \u003ca href='{{tos_link}}' target='blank'\u003ekäyttöehdot\u003c/a\u003e.","title":"Luo uusi tunnus","failed":"Jotain meni pieleen. Ehkäpä tämä sähköpostiosoite on jo rekisteröity, kokeile salasana unohtui -linkkiä."},"forgot_password":{"title":"Salasanan uusiminen","action":"Unohdin salasanani","invite":"Syötä käyttäjätunnuksesi tai sähköpostiosoitteesi, niin lähetämme sinulle salasanan uusimisviestin.","reset":"Uusi salasana","complete_username":"Jos käyttäjätunnusta \u003cb\u003e%{username}\u003c/b\u003e vastaava tili löytyy, saat kohta sähköpostin, jossa on lisäohjeet salasanan uusimiseen.","complete_email":"Jos sähköpostiosoitetta \u003cb\u003e%{email}\u003c/b\u003e vastaava tili löytyy, saat kohta sähköpostin, jossa on lisäohjeet salasanan uusimiseen.","complete_username_found":"Käyttäjätunnusta \u003cb\u003e%{username}\u003c/b\u003e vastaava tili löytyi. Saat kohta sähköpostin, jossa on lisäohjeet salasanan uusimiseen.","complete_email_found":"Sähköpostiosoitetta \u003cb\u003e%{email}\u003c/b\u003e vastaava tili löytyi. Saat kohta sähköpostin, jossa on lisäohjeet salasanan uusimiseen.","complete_username_not_found":"Käyttäjänimeä \u003cb\u003e%{username}\u003c/b\u003e ei ole rekisteröity","complete_email_not_found":"Sähköpostiosoitetta \u003cb\u003e%{email}\u003c/b\u003e vastaavaa tiliä ei ole","help":"Eikö sähköposti saavu? Ensiksi tarkasta roskapostikansiosi.\u003cp\u003eEtkö ole varma sähköpostiosoitteesta? Syötä sähköpostiosoite niin saat tietää onko sillä luotu tunnusta.\u003c/p\u003e\u003cp\u003eJos et enää hallitse sähköpostiosoitettasi, ota yhteyttä \u003ca href='%{basePath}/about'\u003eavuliaaseen henkilökuntaamme.\u003c/a\u003e\u003c/p\u003e","button_ok":"OK","button_help":"Apua"},"email_login":{"link_label":"Lähetä minulle kirjautumislinkki","button_label":"sähköpostilla","complete_username":"Jos on olemassa käyttäjätili käyttäjänimellä \u003cb\u003e%{username}\u003c/b\u003e, kirjautumislinkin sisältävän sähköpostiviestin pitäisi saapua sinulle tuota pikaa.","complete_email":"Jos on olemassa käyttäjätili sähköpostiosoitteella \u003cb\u003e%{email}\u003c/b\u003e, kirjautumislinkin sisältävän sähköpostiviestin pitäisi saapua sinulle tuota pikaa.","complete_username_found":"Käyttäjätili käyttäjänimellä \u003cb\u003e%{username}\u003c/b\u003e löytyi. Kirjautumislinkin sisältävän sähköpostiviestin pitäisi saapua sinulle tuota pikaa.","complete_email_found":"Käyttäjätili sähköpostiosoitteella \u003cb\u003e%{email}\u003c/b\u003e löytyi. Kirjautumislinkin sisältävän sähköpostiviestin pitäisi saapua sinulle tuota pikaa.","complete_username_not_found":"Ei löytynyt käyttäjänimeä \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Ei löytynyt sähköpostiosoitetta \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"Jatka sivustolle %{site_name}","logging_in_as":"Kirjaudutaan käyttäjänä %{email}","confirm_button":"Kirjaudu"},"login":{"title":"Kirjaudu","username":"Käyttäjä","password":"Salasana","second_factor_title":"Kaksivaiheinen tunnistautuminen","second_factor_description":"Syötä sovelluksen antama todennuskoodi:","second_factor_backup":"Kirjaudu käyttäen varakoodia","second_factor_backup_title":"Varakoodit","second_factor_backup_description":"Syötä yksi varakoodeistasi:","second_factor":"Kirjaudu tunnistautumissovelluksella","security_key_description":"Kun fyysinen tunnistautumislaite on kätesi ulottuvilla, klikkaa alla olevaa \"Tunnistaudu tunnistautumislaitteella\" -painiketta.","security_key_alternative":"Kokeile muuta tapaa","security_key_authenticate":"Tunnistaudu tunnistautumislaitteen avulla","security_key_not_allowed_error":"Tunnistaumislaitteella tunnistautumisprosessi joko vanheni tai peruutettiin.","security_key_no_matching_credential_error":"Tunnistautumislaitteelta ei löytynyt kelpaavia pääsytietoja.","security_key_support_missing_error":"Tämä laitteesi tai selaimesi ei tue tunnistaumislaitteita. Käytä muuta tapaa.","email_placeholder":"sähköposti tai käyttäjätunnus","caps_lock_warning":"Caps Lock on päällä","error":"Tuntematon virhe","cookies_error":"Vaikuttaa siltä, että selaimessasi ei ole evästeet käytössä. Et ehkä pysty kirjautumaan sisään ottamatta niitä käyttöön ensin.","rate_limit":"Odota hetki ennen kuin yrität kirjautua uudelleen.","blank_username":"Syötä sähköpostiosoitteesi tai käyttäjänimesi.","blank_username_or_password":"Kirjoita sähköpostiosoite tai käyttäjänimi ja salasana.","reset_password":"Uusi salasana","logging_in":"Kirjaudutaan...","or":"Tai","authenticating":"Autentikoidaan...","awaiting_activation":"Tilisi odottaa aktivointia; unohdin salasanani -linkin kautta voit pyytää uuden aktivointisähköpostin.","awaiting_approval":"Henkilökunta ei ole vielä hyväksynyt käyttäjätiliäsi. Saat sähköpostiviestin, kun tunnuksesi on hyväksytty.","requires_invite":"Pahoittelut, tämä palsta on vain kutsutuille käyttäjille.","not_activated":"Et voi vielä kirjautua sisään. Lähetimme aiemmin vahvistusviestin osoitteeseen \u003cb\u003e{{sentTo}}\u003c/b\u003e. Seuraa viestin ohjeita ottaaksesi tunnuksen käyttöön.","not_allowed_from_ip_address":"Kirjautuminen estetty tästä IP-osoitteesta.","admin_not_allowed_from_ip_address":"Et voi kirjautua ylläpitäjänä tästä IP-osoitteesta.","resend_activation_email":"Klikkaa tästä lähettääksesi vahvistusviestin uudelleen.","omniauth_disallow_totp":"Käyttäjätilisi käyttää kaksivaiheista tunnistautumista. Kirjaudu salasanasi avulla.","resend_title":"Lähetä aktivointisähköposti uudelleen","change_email":"Vaihda sähköpostiosoitetta","provide_new_email":"Anna uusi osoite niin lähetämme sinulle vahvistamissähköpostin.","submit_new_email":"Päivitä sähköpostiosoite","sent_activation_email_again":"Lähetimme uuden vahvistusviestin sinulle osoitteeseen \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Viestin saapumisessa voi kestää muutama minuutti; muista tarkastaa myös roskapostikansio.","sent_activation_email_again_generic":"Lähetimme uuden aktivointisähköpostin. Sen saapumisessa voi kestää joitakin minuutteja; tarkistathan myös roskapostikansiosi.","to_continue":"Ole hyvä ja kirjaudu sisään","preferences":"Sinun täytyy olla kirjautuneena sisään muokataksesi tilisi asetuksia","forgot":"En muista käyttäjätilini tietoja","not_approved":"Tiliäsi ei ole vielä hyväksytty. Saat ilmoituksen sähköpostilla, kun voit kirjautua sisään.","google_oauth2":{"name":"Google","title":"Googlella"},"twitter":{"name":"Twitter","title":"Twitterillä"},"instagram":{"name":"Instagram","title":"Instagramilla"},"facebook":{"name":"Facebook","title":"Facebookilla"},"github":{"name":"GitHub","title":"GitHubilla"},"discord":{"name":"Discord","title":"Discordilla"},"second_factor_toggle":{"totp":"Käytä todennussovellusta tämän sijaan","backup_code":"Käytä varmuuskoodia tämän sijaan"}},"invites":{"accept_title":"Kutsu","welcome_to":"Tervetuloa sivustolle %{site_name}!","invited_by":"Sinut kutsui","social_login_available":"Voit myös kirjautua some-tilin avulla, joka on saman sähköpostiosoitteen alainen.","your_email":"Tilisi sähköpostiosoite on \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"Hyväksy kutsu","success":"Tili luotiin, ja olet nyt kirjautunut sisään.","name_label":"Nimi","password_label":"Aseta salasana","optional_description":"(ei pakollinen)"},"password_reset":{"continue":"Jatka sivustolle %{site_name}"},"emoji_set":{"apple_international":"Apple/Kansainvälinen","google":"Google","twitter":"Twitter","emoji_one":"JoyPixels (aiemmin EmojiOne)","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Vain alueet","categories_with_featured_topics":"Alueet ja esiteltyjä ketjuja","categories_and_latest_topics":"Alueet ja tuoreimmat ketjut","categories_and_top_topics":"Alueet ja kuumia ketjuja","categories_boxes":"Laatikot, joissa tytäralueet","categories_boxes_with_topics":"Laatikot, joissa esiteltyjä ketjuja"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt","enter":"Enter"},"conditional_loading_section":{"loading":"Ladataan..."},"category_row":{"topic_count":"{{count}} ketjua tällä alueella"},"select_kit":{"default_header_text":"Valitse...","no_content":"Ei osumia","filter_placeholder":"Hae...","filter_placeholder_with_any":"Etsi tai luo...","create":"Luo: '{{content}}'","max_content_reached":{"one":"Voit valita vain {{count}} kohteen.","other":"Voit valita enintään {{count}} kohdetta."},"min_content_not_reached":{"one":"Valitse ainakin {{count}} kohde.","other":"Valitse ainakin {{count}} kohdetta."},"invalid_selection_length":"Täytyy valita ainakin {{count}} merkkiä."},"date_time_picker":{"from":"Mistä","to":"Vastaanottaja","errors":{"to_before_from":"Päättymispäivän on oltava myöhempi kuin alkamispäivän."}},"emoji_picker":{"filter_placeholder":"Etsi emojia","smileys_\u0026_emotion":"Hymiöt ja tunteet","people_\u0026_body":"Ihmiset ja kehot","animals_\u0026_nature":"Eläimet ja luonto","food_\u0026_drink":"Ruoka ja juoma","travel_\u0026_places":"Matkustaminen ja paikat","activities":"Harrasteet","objects":"Esineet","symbols":"Symbolit","flags":"Liputukset","recent":"Hiljattain käytetyt","default_tone":"Ei ihonsävyä","light_tone":"Vaalea ihonväri","medium_light_tone":"Vaaleanruskea ihonväri","medium_tone":"Ruskea ihonväri","medium_dark_tone":"Tummanruskea ihonväri","dark_tone":"Tumma ihonväri","default":"Mukautetut emojit"},"shared_drafts":{"title":"Jaetut luonnokset","notice":"Tämä ketju näkyy vain niille, jotka näkevät \u003cb\u003e{{category}}\u003c/b\u003e -alueen.","destination_category":"Kohdealue","publish":"Julkaise jaettu luonnos","confirm_publish":"Haluatko varmasti julkaista luonnoksen?","publishing":"Julkaistaan ketjua..."},"composer":{"emoji":"Emoji :)","more_emoji":"lisää...","options":"Asetukset","whisper":"kuiskaus","unlist":"listaamaton","blockquote_text":"Sitaatti","add_warning":"Tämä on virallinen varoitus.","toggle_whisper":"Vaihda kuiskaus","toggle_unlisted":"Listauksissa näkyminen","posting_not_on_topic":"Mihin ketjuun haluat vastata?","saved_local_draft_tip":"tallennettu omalla koneella","similar_topics":"Tämä ketju vaikuttaa samalta kuin..","drafts_offline":"offline luonnokset","edit_conflict":"muokkauskonflikti","group_mentioned_limit":"\u003cb\u003eVaroitus!\u003c/b\u003e Mainitsit ryhmän \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e, mutta ylläpitäjä on määrittänyt mainintojen enimmäismääräksi {{max}} käyttäjää, minkä tämän ryhmän jäsenmäärä ylittää. Kukaan ei saa ilmoitusta. ","group_mentioned":{"one":"Jos mainitset ryhmän {{group}}, \u003ca href='{{group_link}}'\u003e%{count} käyttäjä\u003c/a\u003e saa ilmoituksen – oletko varma?","other":"Jos mainitset ryhmän {{group}}, \u003ca href='{{group_link}}'\u003e{{count}} käyttäjää\u003c/a\u003e saa ilmoituksen – oletko varma?"},"cannot_see_mention":{"category":"Mainitsit käyttäjän {{username}} mutta hän ei saa ilmoitusta, koska hänellä ei ole pääsyä tälle alueelle. Hänet tulee lisätä ryhmään, jolla on pääsy alueelle.","private":"Mainitsit käyttäjän {{username}} mutta hän ei saa ilmoitusta, koska hän ei näe tätä yksityiskeskustelua. Hänet tulee kutsua tähän yksityiskeskusteluun."},"duplicate_link":"Näyttää siltä, että \u003cb\u003e@{{username}}\u003c/b\u003e linkitti jo samaan kohteeseen \u003cb\u003e{{domain}}\u003c/b\u003e ketjun \u003ca href='{{post_url}}'\u003eaiemmassa viestissä {{ago}}\u003c/a\u003e – oletko varma, että haluat lähettää sen uudestaan?","reference_topic_title":"RE: {{title}}","error":{"title_missing":"Otsikko on pakollinen","title_too_short":"Otsikon täytyy olla vähintään {{min}} merkkiä pitkä","title_too_long":"Otsikko voi olla korkeintaan {{max}} merkkiä pitkä","post_missing":"Viesti ei voi olla tyhjä","post_length":"Viestissä täytyy olla vähintään {{min}} merkkiä","try_like":"Oletko kokeillut {{heart}}-nappia?","category_missing":"Sinun täytyy valita viestille alue","tags_missing":"Valitse vähintään {{count}} tunnistetta","topic_template_not_modified":"Lisää tietoa ketjunaloitukseesi muokkaamalla ketjusapluunaa."},"save_edit":"Tallenna","overwrite_edit":"Päällekirjoita","reply_original":"Vastaa alkuperäiseen ketjuun","reply_here":"Vastaa tänne","reply":"Vastaa","cancel":"Peruuta","create_topic":"Aloita ketju","create_pm":"Viesti","create_whisper":"Kuiskaa","create_shared_draft":"Luo jaettu luonnos","edit_shared_draft":"Muokkaa jaettua luonnosta","title":"Tai paina Ctrl+Enter","users_placeholder":"Lisää käyttäjä","title_placeholder":"Kuvaile lyhyesti mistä tässä ketjussa on kyse?","title_or_link_placeholder":"Kirjoita otsikko tai liitä linkki tähän","edit_reason_placeholder":"miksi muokkaat viestiä?","topic_featured_link_placeholder":"Tähän linkki, joka näytetään otsikon yhteydessä.","remove_featured_link":"Poista ketjulinkki","reply_placeholder":"Kirjoita tähän. Käytä Markdownia, BBCodea tai HTML:ää muotoiluun. Raahaa tai liitä kuvia.","reply_placeholder_no_images":"Kirjoita tähän. Muotoile Markdown, BBCode tai HTML-syntaksilla.","reply_placeholder_choose_category":"Valitse alue ennen kuin kirjoitat tähän.","view_new_post":"Katsele uutta viestiäsi.","saving":"Tallennetaan","saved":"Tallennettu!","saved_draft":"Viestiluonnos kesken. Jatka klikkaamalla.","uploading":"Lähettää...","show_preview":"näytä esikatselu \u0026raquo;","hide_preview":"\u0026laquo; piilota esikatselu","quote_post_title":"Lainaa koko viesti","bold_label":"B","bold_title":"Lihavoitu","bold_text":"lihavoitu teksti","italic_label":"I","italic_title":"Kursiivi","italic_text":"kursivoitu teksti","link_title":"Hyperlinkki","link_description":"kirjoita linkin kuvaus tähän","link_dialog_title":"Lisää linkki","link_optional_text":"ei-pakollinen kuvaus","link_url_placeholder":"Liitä URL tai etsi ketjua kirjoittamalla","quote_title":"Lainaus","quote_text":"Lainaus","code_title":"Teksti ilman muotoiluja","code_text":"Sisennä teksti neljällä välilyönnillä poistaaksesi automaattisen muotoilun","paste_code_text":"kirjoita tai liitä koodia tähän","upload_title":"Lähetä","upload_description":"kirjoita ladatun tiedoston kuvaus tähän","olist_title":"Numeroitu lista","ulist_title":"Luettelomerkillinen luettelo","list_item":"Listan alkio","toggle_direction":"Vaihda suuntaa","help":"Markdown apu","collapse":"pienennä kirjoitusalue","open":"avaa viestikenttä","abandon":"sulje kirjoitusalue ja poista luonnos","enter_fullscreen":"siirry koko ruudun kirjoitustilaan","exit_fullscreen":"poistu koko ruudun kirjoitustilasta","modal_ok":"OK","modal_cancel":"Peruuta","cant_send_pm":"Et voi lähettää viestiä käyttäjälle %{username}.","yourself_confirm":{"title":"Unohditko lisätä vastaanottajia?","body":"Olet lähettämässä viestiä vain itsellesi!"},"admin_options_title":"Tämän ketjun vain henkilökunnalle näytettävät asetukset","composer_actions":{"reply":"Vastaa","draft":"Luonnos","edit":"Muokkaa","reply_to_post":{"label":"Vastaus käyttäjän %{postUsername} viestiin %{postNumber}","desc":"Vastaa tiettyyn viestiin"},"reply_as_new_topic":{"label":"Vastaa sivuavassa ketjussa","desc":"Aloita uusi, tähän ketjuun linkittyvä ketju","confirm":"Tallennettuna on yksi sinun ketjunaloitusluonnos, joka poistetaan, jos vastaat uudessa ketjussa."},"reply_as_private_message":{"label":"Uusi viesti","desc":"Aloita uusi yksityiskeskustelu"},"reply_to_topic":{"label":"Vastaa ketjuun","desc":"Vastaa ketjuun muttei mihinkään tiettyyn viestiin"},"toggle_whisper":{"label":"Kuiskaus päälle/pois","desc":"Kuiskaukset näkyvät vain henkilökuntalaisille"},"create_topic":{"label":"Uusi ketju"},"shared_draft":{"label":"Jaettu luonnos","desc":"Luonnostele ketju, joka näkyy vain henkilökunnalle"},"toggle_topic_bump":{"label":"Ketjun nosto päälle/pois","desc":"Vastaa muuttamatta ketjun viimeisin viesti -aikaleimaa"}},"details_title":"Yhteenveto","details_text":"Tämä teksti piilotetaan otsikon alle."},"notifications":{"tooltip":{"regular":{"one":"Uusi ilmoitus","other":"{{count}} uutta ilmoitusta"},"message":{"one":"Uusi yksityisviesti","other":"{{count}} uutta yksityisviestiä"}},"title":"ilmoitukset @nimeen viittauksista, vastauksista omiin viesteihin ja ketjuihin, viesteistä ym.","none":"Ilmoitusten lataaminen ei onnistunut.","empty":"Ilmoituksia ei löydetty.","post_approved":"Viestisi hyväksyttiin","reviewable_items":"käsittelyä odottavaa asiaa","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} ja %{count} muu\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} ja {{count}} muuta\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"tykkäsi {{count}} viestistäsi","other":"tykkäsi {{count}} viestistäsi"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e hyväksyi kutsusi","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e siirsi {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"Ansaitsit '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eUusi ketju\u003c/span\u003e {{description}}","membership_request_accepted":"Hyväksyttiin ryhmään '{{group_name}}'","membership_request_consolidated":"{{count}} odottavaa jäsenhakemusta ryhmään {{group_name}}","group_message_summary":{"one":"{{count}} viesti ryhmän {{group_name}} saapuneissa","other":"{{count}} viestiä ryhmän {{group_name}} saapuneissa"},"popup":{"mentioned":"{{username}} mainitsi sinut ketjussa \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} mainitsi sinut ketjussa \"{{topic}}\" - {{site_title}}","quoted":"{{username}} lainasi sinua ketjussa \"{{topic}}\" - {{site_title}}","replied":"{{username}} vastasi sinulle ketjussa \"{{topic}}\" - {{site_title}}","posted":"{{username}} vastasi ketjuun \"{{topic}}\" - {{site_title}}","private_message":"{{username}} lähetti sinulle yksityisviestin keskustelussa \"{{topic}}\" - {{site_title}}","linked":"{{username}} linkitti viestiisi ketjusta \"{{topic}}\" - {{site_title}}","watching_first_post":"{{username}} loi uuden ketjun \"{{topic}}\" - {{site_title}}","confirm_title":"Ilmoitukset käytössä - %{site_title}","confirm_body":"Onnistui! Ilmoitukset ovat nyt käytössä.","custom":"Ilmoitus käyttäjältä {{username}} sivustolla %{site_title}"},"titles":{"mentioned":"mainitsi","replied":"uusi vastaus","quoted":"lainasi","edited":"muokkasi","liked":"uusi tykkäys","private_message":"uusi yksityisviesti","invited_to_private_message":"kutsuttiin yksityiskeskusteluun","invitee_accepted":"kutsu hyväksyttiin","posted":"uusi viesti","moved_post":"viesti siirrettiin","linked":"linkitti","granted_badge":"ansiomerkki myönnettiin","invited_to_topic":"kutsuttiin ketjuun","group_mentioned":"ryhmä mainittiin","group_message_summary":"uusia ryhmäyksityisviestejä","watching_first_post":"uusi ketju","topic_reminder":"ketjumuistutus","liked_consolidated":"uusia tykkäyksiä","post_approved":"viesti hyväksytty","membership_request_consolidated":"uusia jäsenhakemuksia"}},"upload_selector":{"title":"Lisää kuva","title_with_attachments":"Lisää kuva tai tiedosto","from_my_computer":"Tästä laitteesta","from_the_web":"Netistä","remote_tip":"linkki kuvaan","remote_tip_with_attachments":"linkki kuvaan tai tiedostoon {{authorized_extensions}}","local_tip":"valitse kuvia laitteeltasi","local_tip_with_attachments":"valitse kuvia tai tiedostoja laitteeltasi {{authorized_extensions}}","hint":"(voit myös raahata ne editoriin ladataksesi ne sivustolle)","hint_for_supported_browsers":"voit myös raahata tai liittää kuvia editoriin","uploading":"Lähettää","select_file":"Valitse tiedosto","default_image_alt_text":"kuva"},"search":{"sort_by":"Järjestä","relevance":"Osuvuus","latest_post":"Uusin viesti","latest_topic":"Uusin ketju","most_viewed":"Katselluin","most_liked":"Tykätyin","select_all":"Valitse kaikki","clear_all":"Tyhjennä kaikki","too_short":"Hakusana on liian lyhyt.","result_count":{"one":"\u003cspan\u003e%{count} tulos haulle\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","other":"\u003cspan\u003e{{count}}{{plus}} tulosta haulle\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"title":"etsi ketjuja, viestejä, käyttäjiä tai alueita","full_page_title":"etsi ketjuja tai viestejä","no_results":"Ei tuloksia.","no_more_results":"Enempää tuloksia ei löytynyt.","searching":"Etsitään ...","post_format":"#{{post_number}} käyttäjältä {{username}}","results_page":"Tulokset hakusanalle '{{term}}'","more_results":"Tuloksia olisi enemmänkin. Rajaa hakuasi.","cant_find":"Etkö löydä etsimääsi?","start_new_topic":"Haluaisitko aloittaa uuden ketjun?","or_search_google":"Tai kokeile Google-hakua:","search_google":"Kokeile Google-hakua:","search_google_button":"Google","search_google_title":"Hae tältä sivustolta","context":{"user":"Etsi @{{username}} viestejä","category":"Etsi alueelta #{{category}}","tag":"Hae tunnistetta #{{tag}}","topic":"Etsi tästä ketjusta","private_messages":"Etsi viesteistä"},"advanced":{"title":"Tarkennettu haku","posted_by":{"label":"Kirjoittaja"},"in_category":{"label":"Sijaitsee alueella"},"in_group":{"label":"Kirjoittajan ryhmä"},"with_badge":{"label":"Kirjoittajalla ansiomerkki"},"with_tags":{"label":"Ketjulla on tunniste"},"filters":{"label":"Tuloksiin vain ketjuja/viestejä...","title":"Etsi vain otsikoista","likes":"joista olen tykännyt","posted":"joihin olen kirjoittanut","created":"jotka minä aloitin","watching":"joita tarkkailen","tracking":"joita seuraan","private":"yksityiskeskusteluistani","bookmarks":"kirjanmerkeistäni","first":"jotka ovat ketjun avausviestejä","pinned":"jotka on kiinnitettyjä","unpinned":"jotka eivät ole kiinnitettyjä","seen":"jotka olen lukenut","unseen":"joita en ole lukenut","wiki":"ovat wiki-viestejä","images":"joissa on kuv(i)a","all_tags":"Ketjulla on kaikki nämä tunnisteet"},"statuses":{"label":"Ketju/Ketjuun","open":"on avoin","closed":"on suljettu","public":"ovat julkisia","archived":"on arkistoitu","noreplies":"ei ole vastattu","single_user":"on kirjoittanut vain yksi käyttäjä"},"post":{"count":{"label":"Viestejä vähintään"},"time":{"label":"Kirjoitettu","before":"ennen","after":"jälkeen"}}}},"hamburger_menu":"vaihda ketjulistausta tai siirry toiselle alueelle","new_item":"uusi","go_back":"mene takaisin","not_logged_in_user":"käyttäjäsivu, jossa on tiivistelmä käyttäjän viimeaikaisesta toiminnasta sekä käyttäjäasetukset","current_user":"siirry omalle käyttäjäsivullesi","view_all":"katso kaikki","topics":{"new_messages_marker":"edellinen vierailu","bulk":{"select_all":"Valitse kaikki","clear_all":"Tyhjennä kaikki","unlist_topics":"Poista ketjuja listauksista","relist_topics":"Palauta ketjuja listauksiin","reset_read":"Palauta lukutila","delete":"Poista ketjut","dismiss":"Unohda","dismiss_read":"Unohda lukemattomat","dismiss_button":"Unohda...","dismiss_tooltip":"Unohda uudet viestit tai lopeta ketjujen seuraaminen","also_dismiss_topics":"Älä seuraa näitä ketjuja enää - ne eivät jatkossa näy Lukematta-välilehdellä","dismiss_new":"Unohda uudet","toggle":"Vaihda useamman ketjun valintaa","actions":"Massatoiminnot","change_category":"Määritä alue","close_topics":"Sulje ketjut","archive_topics":"Arkistoi ketjut","notification_level":"Ilmoitukset","choose_new_category":"Valitse uusi alue ketjuille:","selected":{"one":"Olet valinnut \u003cb\u003eyhden\u003c/b\u003e ketjun.","other":"Olet valinnut \u003cb\u003e{{count}}\u003c/b\u003e ketjua."},"change_tags":"Korvaa tunnisteet","append_tags":"Lisää tunnisteita","choose_new_tags":"Valitse tunnisteet näille ketjuille:","choose_append_tags":"Valitse ketjuille lisättävät uudet tunnisteet:","changed_tags":"Ketjujen tunnisteet muutettiin."},"none":{"unread":"Sinulla ei ole ketjuja lukematta.","new":"Sinulla ei ole uusia ketjuja.","read":"Et ole lukenut vielä yhtään yhtään ketjua.","posted":"Et ole kirjoittanut vielä yhteenkään ketjuun.","latest":"Tuoreimpia ketjuja ei ole. Onpa harmi.","bookmarks":"Et ole vielä merkinnyt kirjanmerkkejä.","category":"Alueella {{category}} ei ole ketjua.","top":"Kuumia ketjuja ei ole.","educate":{"new":"\u003cp\u003eSinulle uudet ketjut näytetään tässä.\u003c/p\u003e\u003cp\u003eKetju tulkitaan uudeksi ja sen yhteydessä näytetään \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003euusi\u003c/span\u003e-merkintä, jos se on aloitettu edellisten kahden päivän aikana.\u003c/p\u003e\u003cp\u003eAikarajaa voit muuttaa \u003ca href=\"%{userPrefsUrl}\"\u003ekäyttäjäasetuksissasi\u003c/a\u003e.\u003c/p\u003e","unread":"\u003cp\u003eLukemattomia viestejä sisältävät ketjut näytetään tässä.\u003c/p\u003e\u003cp\u003eKetjun yhteydessä näytetään lukemattomien viestien lukumäärä \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e, jos olet:\u003c/p\u003e\u003cul\u003e\u003cli\u003ealoittanut ketjun\u003c/li\u003e\u003cli\u003evastannut ketjuun\u003c/li\u003e\u003cli\u003elukenut ketjua pidempään, kuin 4 minuuttia\u003c/li\u003e\u003c/ul\u003e\u003cp\u003etai, jos olet erikseen merkannut ketjun seurattavaksi tai tarkkailtavaksi ketjun lopusta löytyvästä painikkeesta.\u003c/p\u003e\u003cp\u003eVoit muuttaa tätä \u003ca href=\"%{userPrefsUrl}\"\u003ekäyttäjäasetuksistasi\u003c/a\u003e.\u003c/p\u003e"}},"bottom":{"latest":"Tuoreimpia ketjuja ei ole enempää.","posted":"Ketjuja, joihin olet kirjoittanut ei ole enempää.","read":"Luettuja ketjuja ei ole enempää.","new":"Uusia ketjuja ei ole enempää.","unread":"Ketjuja ei ole enempää lukematta.","category":"Alueen {{category}} ketjuja ei ole enempää.","top":"Kuumia ketjuja ei ole enempää.","bookmarks":"Merkattuja ketjuja ei ole enempää."}},"topic":{"filter_to":{"one":"%{count} viesti ketjussa","other":"{{count}} viestiä ketjussa"},"create":"Uusi ketju","create_long":"Aloita uusi ketju","open_draft":"Avaa luonnos","private_message":"Luo viesti","archive_message":{"help":"Siirrä viesti arkistoosi","title":"Arkistoi"},"move_to_inbox":{"title":"Siirrä saapuneisiin","help":"Siirrä takaisin saapuneisiin."},"edit_message":{"help":"Muokkaa keskustelun ensimmäistä viestiä","title":"Muokkaa viestiä"},"defer":{"help":"Merkitse lukemattomaksi","title":"Lykkää"},"feature_on_profile":{"help":"Lisää käyttäjäkorttiisi ja profiilisivullesi linkki tähän ketjuun","title":"Valikoi ketju profiiliisi"},"remove_from_profile":{"warning":"Profiilillesi on jo valikoitu ketju. Jos jatkat, tämä ketju korvaa aiemman ketjun.","help":"Poista linkki tähän ketjuun käyttäjäprofiilissasi","title":"Poista profiilista"},"list":"Ketjut","new":"uusi ketju","unread":"lukematta","new_topics":{"one":"%{count} uusi ketju","other":"{{count}} uutta ketjua"},"unread_topics":{"one":"%{count} ketju lukematta","other":"{{count}} ketjua lukematta"},"title":"Aihe","invalid_access":{"title":"Tämä ketju on yksityinen","description":"Pahoittelut, sinulla ei ole pääsyä tähän ketjuun!","login_required":"Sinun täytyy kirjautua sisään nähdäksesi tämän ketjun."},"server_error":{"title":"Ketjun lataaminen epäonnistui","description":"Pahoittelut, ketjun lataaminen epäonnistui. Kyse saattaa olla yhteysongelmasta. Kokeile sivun lataamista uudestaan ja jos ongelma jatkuu, ota yhteyttä."},"not_found":{"title":"Ketjua ei löytynyt","description":"Pahoittelut, ketjua ei löytynyt. Ehkäpä valvoja on siirtänyt sen muualle?"},"total_unread_posts":{"one":"sinulla on %{count} lukematon viesti tässä ketjussa","other":"sinulla on {{count}} lukematonta viestiä tässä ketjussa"},"unread_posts":{"one":"yksi vanha viesti on lukematta tässä ketjussa","other":"{{count}} vanhaa viestiä on lukematta tässä ketjussa"},"new_posts":{"one":"tähän ketjuun on tullut yksi uusi viesti sen jälkeen, kun edellisen kerran luit sen","other":"tähän ketjuun on tullut {{count}} uutta viestiä sen jälkeen, kun edellisen kerran luit sen"},"likes":{"one":"tässä ketjussa on yksi tykkäys","other":"tässä ketjussa on {{count}} tykkäystä"},"back_to_list":"Takaisin ketjulistaan","options":"Ketjun asetukset","show_links":"näytä tämän ketjun linkit","toggle_information":"näytä/kätke ketjun tiedot","read_more_in_category":"Haluatko lukea lisää? Selaile muita alueen {{catLink}} ketjuja tai {{latestLink}}.","read_more":"Haluatko lukea lisää? Selaa aluetta {{catLink}} tai katsele {{latestLink}}.","group_request":"Jos haluat nähdä tämän ketjun, hae ryhmän `{{name}}` jäsenyyttä","group_join":"Jos haluat nähdä tämän ketjun, sinun täytyy liittyä ryhmään `{{name}}`","group_request_sent":"Ryhmän jäsenyyspyyntösi on lähetetty. Saat ilmoituksen, kun se on hyväksytty.","unread_indicator":"Kukaan jäsen ei ole lukenut ketjun viimeistä viestiä vielä.","browse_all_categories":"Selaa keskustelualueita","view_latest_topics":"tuoreimpia ketjuja","suggest_create_topic":"Jospa aloittaisit uuden ketjun?","jump_reply_up":"hyppää aiempaan vastaukseen","jump_reply_down":"hyppää myöhempään vastaukseen","deleted":"Tämä ketju on poistettu","topic_status_update":{"title":"Ketjun ajastin","save":"Aseta ajastin","num_of_hours":"Kuinka monta tuntia:","remove":"Poista ajastin","publish_to":"Mihin julkaistaan:","when":"Milloin:","public_timer_types":"Ketjuajastimet","private_timer_types":"Käyttäjän ketjuajastimet","time_frame_required":"Valitse ajanjakso"},"auto_update_input":{"none":"Valitse ajanjakso","later_today":"Myöhemmin tänään","tomorrow":"Huomenna","later_this_week":"Myöhemmin tällä viikolla","this_weekend":"Viikonloppuna","next_week":"Ensi viikolla","two_weeks":"Kahden viikon kuluttua","next_month":"Ensi kuussa","two_months":"Kaksi kuukautta","three_months":"Kolme kuukautta","four_months":"Neljä kuukautta","six_months":"Kuusi kuukautta","one_year":"Yksi vuosi","forever":"Ikuisesti","pick_date_and_time":"Valitse päivämäärä ja kellonaika","set_based_on_last_post":"Sulje viimeisimmän viestin mukaan"},"publish_to_category":{"title":"Julkaise määrättynä ajankohtana"},"temp_open":{"title":"Avaa väliaikaisesti"},"auto_reopen":{"title":"Avaa ketju automaattisesti"},"temp_close":{"title":"Sulje väliaikaisesti"},"auto_close":{"title":"Sulje ketju automaattisesti","label":"Tunteja automaattiseen sulkeutumiseen:","error":"Arvo ei kelpaa.","based_on_last_post":"Älä sulje ennen kuin viimeisin viesti ketjussa on ainakin näin vanha."},"auto_delete":{"title":"Poista ketju ajastetusti"},"auto_bump":{"title":"Nosta ketjua ajastetusti"},"reminder":{"title":"Muistuta minua"},"status_update_notice":{"auto_open":"Ketju avautuu automaattisesti %{timeLeft}.","auto_close":"Ketju suljetaan ajastetusti %{timeLeft}.","auto_publish_to_category":"Ketju julkaistaan alueella \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e %{timeLeft}.","auto_close_based_on_last_post":"Ketju sulkeutuu %{duration} kuluttua viimeisimmästä viestistä.","auto_delete":"Ketju poistetaan ajastetusti %{timeLeft}.","auto_bump":"Ketjua nostetaan ajastetusti %{timeLeft}.","auto_reminder":"Sinua muistutetaan tästä ketjusta %{timeLeft}."},"auto_close_title":"Automaattisen sulkemisen asetukset","auto_close_immediate":{"one":"Ketjun viimeisin viesti on jo tunnin vanha, joten ketju suljetaan heti.","other":"Ketjun viimeisin viesti on jo %{hours} tuntia vanha, joten ketju suljetaan heti."},"timeline":{"back":"Takaisin","back_description":"Siirry takaisin ensimmäiseen lukemattomaan viestiin","replies_short":"%{current} / %{total}"},"progress":{"title":"ketjun edistyminen","go_top":"alkuun","go_bottom":"loppuun","go":"siirry","jump_bottom":"hyppää viimeisimpään viestiin","jump_prompt":"hyppää...","jump_prompt_of":"%{count} viestistä","jump_prompt_long":"Hyppää...","jump_bottom_with_number":"hyppää viestiin %{post_number}","jump_prompt_to_date":"päivämäärään","jump_prompt_or":"tai","total":"yhteensä viestejä","current":"tämänhetkinen viesti"},"notifications":{"title":"muuta sitä, kuinka usein saat muistutuksia tästä ketjusta","reasons":{"mailing_list_mode":"Olet postituslistatilassa, joten saat sähköpostia tähän ketjuun lähetyistä vastauksista.","3_10":"Saat ilmoituksia, koska tarkkailet tähän ketjuun liittyvää tunnistetta.","3_6":"Saat ilmoituksia, koska olet asettanut tämän alueen tarkkailuun.","3_5":"Saat ilmoituksia, koska ketju on asetettu tarkkailuun automaattisesti.","3_2":"Saat ilmoituksia, koska olet asettanut ketjun tarkkailuun.","3_1":"Saat ilmoituksia, koska aloitit tämän ketjun.","3":"Saat ilmoituksia, koska olet asettanut ketjun tarkkailuun.","2_8":"Näet uusien vastausten määrän, koska olet asettanut tämän alueen seurantaan.","2_4":"Näet uusien vastausten määrän, koska olet kirjoittanut ketjuun.","2_2":"Näet uusien vastausten määrän, koska olet asettanut ketjun seurantaan.","2":"Näet uusien vastausten määrän, koska \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003eluit ketjua aiemmin\u003c/a\u003e.","1_2":"Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa sinulle.","1":"Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa sinulle.","0_7":"Et saa mitään ilmoituksia tältä alueelta.","0_2":"Et saa mitään ilmoituksia tästä ketjusta.","0":"Et saa mitään ilmoituksia tästä ketjusta."},"watching_pm":{"title":"Tarkkaile","description":"Saat ilmoituksen kaikista uusista vastauksista tässä viestiketjussa ja uusien vastausten lukumäärä näytetään."},"watching":{"title":"Tarkkaile","description":"Saat ilmoituksen kaikista uusista vastauksista tässä viestiketjussa ja uusien vastausten lukumäärä näytetään."},"tracking_pm":{"title":"Seuraa","description":"Tälle ketjulle näytetään uusien vastausten lukumäärä. Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa sinulle."},"tracking":{"title":"Seuraa","description":"Tälle ketjulle näytetään uusien vastausten lukumäärä. Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa sinulle."},"regular":{"title":"Tavallinen","description":"Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa sinulle."},"regular_pm":{"title":"Tavallinen","description":"Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa sinulle."},"muted_pm":{"title":"Vaimenna","description":"Et saa mitään ilmoituksia tästä keskustelusta."},"muted":{"title":"Vaimenna","description":"Et saa ilmoituksia mistään tässä ketjussa, eikä se näy tuoreimmissa."}},"actions":{"title":"Toiminnot","recover":"Peru ketjun poisto","delete":"Poista ketju","open":"Avaa ketju","close":"Sulje ketju","multi_select":"Valitse viestejä...","timed_update":"Aseta ajastin ketjulle...","pin":"Kiinnitä ketju...","unpin":"Poista ketjun kiinnitys...","unarchive":"Poista ketjun arkistointi","archive":"Arkistoi ketju","invisible":"Poista listauksista","visible":"Näytä listauksissa","reset_read":"Poista tieto lukemisista","make_public":"Tee ketjusta julkinen","make_private":"Muuta yksityiskeskusteluksi","reset_bump_date":"Palauta ketjun päiväysleima"},"feature":{"pin":"Kiinnitä ketju","unpin":"Poista ketjun kiinnitys","pin_globally":"Kiinnitä ketju koko palstalle","make_banner":"Tee ketjusta banneri","remove_banner":"Poista banneri"},"reply":{"title":"Vastaa","help":"aloita kirjoittamaan vastausta tähän ketjuun"},"clear_pin":{"title":"Poista kiinnitys","help":"Poista kiinnitys, jotta ketju ei enää pysy listauksen ylimpänä"},"share":{"title":"Jaa","extended_title":"Jaa linkki","help":"jaa linkki tähän ketjuun"},"print":{"title":"Tulosta","help":"Avaa tulostettava versio tästä ketjusta"},"flag_topic":{"title":"Liputa","help":"liputa tämä ketju tai lähetä siitä yksityinen ilmoitus valvojalle","success_message":"Ketjun liputus onnistui."},"make_public":{"title":"Muuta julkiseksi ketjuksi","choose_category":"Valitse alue julkiselle ketjulle:"},"feature_topic":{"title":"Nosta tämä ketju","pin":"Kiinnitä tämä ketju alueen {{categoryLink}} ylimmäiseksi kunnes","confirm_pin":"Jo {{count}} ketjua on kiinnitetty. Liian monta kiinnitettyä ketjua voi olla taakaksi uusille ja kirjautumattomille käyttäjille. Oletko varma, että haluat kiinnittää yhden ketjun lisää tälle alueelle?","unpin":"Älä enää pidä tätä ketjua {{categoryLink}}-aluen ylimmäisenä.","unpin_until":"Poista nyt tämän ketjun kiinnitys alueen {{categoryLink}} ylimmäisenä, tai odota kunnes \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Käyttäjät voivat poistaa ketjun kiinnityksen itseltään.","pin_validation":"Päivämäärä vaaditaan kiinnittämään tämä ketju","not_pinned":"Alueella {{categoryLink}} ei ole kiinnitettyjä ketjuja.","already_pinned":{"one":"Kiinnitettyjä ketjuja alueella {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Alueelle {{categoryLink}} kiinnitettyjä ketjuja: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Kiinnitä tämä ketju kaikkien alueiden ylimmäiseksi, kunnes","confirm_pin_globally":"Jo {{count}} ketjua on kiinnitetty koko palstalle. Liian monta kiinnitettyä ketjua voi olla taakaksi uusille ja kirjautumattomille käyttäjille. Oletko varma, että haluat kiinnittää yhden ketjun lisää koko palstalle?","unpin_globally":"Älä enää pidä tätä ketjua kaikkien alueiden ylimmäisenä.","unpin_globally_until":"Poista nyt tämän ketjun kiinnitys kaikkien alueiden ylimmäisenä, tai odota kunnes \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Käyttäjät voivat poistaa ketjun kiinnityksen itseltään.","not_pinned_globally":"Yhtään ketjua ei ole kiinnitetty koko palstalle.","already_pinned_globally":{"one":"Koko palstalle kiinnitettyjä ketjuja: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Koko palstalle kiinnitettyjä ketjuja: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Tee tästä ketjusta banneri, joka näytetään kaikkien sivujen ylimmäisenä.","remove_banner":"Poista banneri, joka näytetään kaikkien sivujen ylimmäisenä.","banner_note":"Käyttäjät voivat piilottaa bannerin sulkemalla sen. Vain yksi ketju kerrallaan voi olla banneri.","no_banner_exists":"Banneriketjua ei ole määritelty.","banner_exists":"Banneriketju \u003cstrong class='badge badge-notification unread'\u003eon\u003c/strong\u003e määritelty."},"inviting":"Kutsutaan...","automatically_add_to_groups":"Tämä kutsu sisältää myös pääsyn näihin ryhmiin:","invite_private":{"title":"Kutsu keskusteluun","email_or_username":"Kutsuttavan sähköpostiosoite tai käyttäjänimi","email_or_username_placeholder":"sähköpostiosoite tai käyttäjänimi","action":"Kutsu","success":"Käyttäjä on kutsuttu osallistumaan tähän yksityiseen keskusteluun.","success_group":"Ryhmä on kutsuttu osallistumaan tähän yksityiseen keskusteluun.","error":"Pahoittelut, kutsuttaessa tapahtui virhe.","group_name":"ryhmän nimi"},"controls":"Ketjun hallinta","invite_reply":{"title":"Kutsu","username_placeholder":"käyttäjätunnus","action":"Lähetä kutsu","help":"Kutsu muita tähän ketjuun sähköpostin tai palstan ilmoitusten kautta","to_forum":"Lähetämme lyhyen sähköpostin jonka avulla ystäväsi voi liittyä klikkaamalla linkkiä, sisäänkirjautumista ei tarvita.","sso_enabled":"Syötä henkilön käyttäjätunnus, jonka haluaisit kutsua tähän ketjuun.","to_topic_blank":"Syötä henkilön käyttäjätunnus tai sähköpostiosoite, jonka haluaisit kutsua tähän ketjuun.","to_topic_email":"Syötit sähköpostiosoitteen. Lähetämme ystävällesi sähköpostin, jonka avulla hän voi heti vastata tähän ketjuun.","to_topic_username":"Annoit käyttäjänimen. Lähetämme hänelle ilmoituksen, jossa on linkki ja kutsu tähän ketjuun.","to_username":"Kirjoita henkilön käyttäjänimi, jonka haluat kutsua. Lähetämme hänelle ilmoituksen, jossa on linkki ja kutsu tähän ketjuun.","email_placeholder":"nimi@esimerkki.fi","success_email":"Olemme lähettäneet kutsun osoitteeseen \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Ilmoitamme, kun kutsuun on vastattu. Voit seurata käyttäjäsivusi kutsut-välilehdeltä kutsujesi tilannetta.","success_username":"Olemme kutsuneet käyttäjän osallistumaan tähän ketjuun.","error":"Pahoittelut, emme onnistuneet kutsumaan tätä henkilöä. Ehkäpä hänet on jo kutsuttu? (Huomaa, että kutsumistiheyttä rajoitetaan)","success_existing_email":"On jo olemassa käyttäjä sähköpostiosoitteella \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Hänet kutsuttiin osallistumaan tähän ketjuun."},"login_reply":"Kirjaudu sisään vastataksesi","filters":{"n_posts":{"one":"%{count} viesti","other":"{{count}} viestiä"},"cancel":"Poista suodatin"},"move_to":{"title":"Siirrä","action":"siirrä","error":"Viestien siirtäminen epäonnistui."},"split_topic":{"title":"Siirrä uuteen ketjuun","action":"siirrä uuteen ketjuun","topic_name":"Uuden ketjun otsikko","radio_label":"Uusi ketju","error":"Viestien siirtämisessä uuteen ketjuun tapahtui virhe.","instructions":{"one":"Olet luomassa uutta ketjua valitsemastasi viestistä.","other":"Olet aloittamassa uutta ketjua valitsemistasi \u003cb\u003e{{count}}\u003c/b\u003e viestistä."}},"merge_topic":{"title":"Siirrä olemassa olevaan ketjuun","action":"siirrä olemassa olevaan ketjuun","error":"Viestien siirtämisessä ketjuun tapahtui virhe.","radio_label":"Olemassa oleva ketju","instructions":{"one":"Valitse ketju, johon haluat siirtää valitun viestin.","other":"Valitse ketju, johon haluat siirtää valitut \u003cb\u003e{{count}}\u003c/b\u003e viestiä."}},"move_to_new_message":{"title":"Siirrä uuteen yksityiskeskusteluun","action":"siirrä uuteen yksityiskeskusteluun","message_title":"Uuden keskustelun otsikko","radio_label":"Uusi yksityiskeskustelu","participants":"Osallistujat","instructions":{"one":"Olet luomassa uutta keskustelua, jossa olisi viesti, jonka olet valinnut.","other":"Olet luomassa uutta keskustelua, jossa olisi \u003cb\u003e{{count}}\u003c/b\u003e viestiä, jotka olet valinnut."}},"move_to_existing_message":{"title":"Siirrä olemassa olevaan keskusteluun","action":"siirrä olemassa olevaan keskusteluun","radio_label":"Olemassa oleva keskustelu","participants":"Osallistujat","instructions":{"one":"Valitse keskustelu, johon haluat siirtää tämän viestin.","other":"Valitse keskustelu, johon haluat siirtää nämä \u003cb\u003e{{count}}\u003c/b\u003e viestiä."}},"merge_posts":{"title":"Yhdistä valitut viestit","action":"yhdistä valitut viestit","error":"Valittuja viestejä yhdistettäessä tapahtui virhe."},"change_owner":{"title":"Vaihda omistajaa","action":"muokkaa omistajuutta","error":"Viestin omistajan vaihdossa tapahtui virhe.","placeholder":"uuden omistajan käyttäjätunnus","instructions":{"one":"Valitse uusi omistaja käyttäjän \u003cb\u003e@{{old_user}}\u003c/b\u003e viestille.","other":"Valitse uusi omistaja käyttäjän \u003cb\u003e@{{old_user}}\u003c/b\u003e {{count}} viestille."}},"change_timestamp":{"title":"Muuta aikaleimaa...","action":"muuta aikaleimaa","invalid_timestamp":"Aikaleima ei voi olla tulevaisuudessa.","error":"Ketjun aikaleiman vaihtamisessa tapahtui virhe","instructions":"Ole hyvä ja valitse ketjulle uusi aikaleima. Ketjun viestit päivitetään samalla aikaerolla."},"multi_select":{"select":"valitse","selected":"valittuna ({{count}})","select_post":{"label":"valitse","title":"Lisää viesti valittuihin"},"selected_post":{"label":"valittu","title":"Poista valituista klikkaamalla"},"select_replies":{"label":"valitse +vastaukset","title":"Lisää viesti ja vastaukset siihen valittuihin"},"select_below":{"label":"valitse +myöhemmät","title":"Lisää viesti ja kaikki myöhemmät valittuihin"},"delete":"poista valitut","cancel":"kumoa valinta","select_all":"valitse kaikki","deselect_all":"poista kaikkien valinta","description":{"one":"Olet valinnut \u003cb\u003eyhden\u003c/b\u003e viestin.","other":"Olet valinnut \u003cb\u003e{{count}}\u003c/b\u003e viestiä."}},"deleted_by_author":{"one":"(kirjoittaja perui ketjun, poistetaan automaattisesti %{count} tunnin kuluttua, paitsi jos liputetaan)","other":"(kirjoittaja perui ketjun, poistetaan automaattisesti %{count} tunnin kuluttua, paitsi jos liputetaan)"}},"post":{"quote_reply":"Lainaa","edit_reason":"Syy:","post_number":"viesti {{number}}","ignored":"Sivuutettua sisältöä","wiki_last_edited_on":"wikiä muokattiin viimeksi","last_edited_on":"viestin viimeisin muokkausaika","reply_as_new_topic":"Vastaa aihetta sivuavassa ketjussa","reply_as_new_private_message":"Vastaa samoille vastaanottajille uudessa yksityisviestiketjussa","continue_discussion":"Jatkoa ketjulle {{postLink}}:","follow_quote":"siirry lainattuun viestiin","show_full":"Näytä koko viesti","show_hidden":"Katso sivuutettu sisältö.","deleted_by_author":{"one":"(kirjoittaja on perunut viestin ja se poistetaan automaattisesti tunnin kuluttua, paitsi jos se liputetaan)","other":"(kirjoittaja on perunut viestin ja se poistetaan automaattisesti %{count} tunnin kuluttua, paitsi jos se liputetaan)"},"collapse":"kutista","expand_collapse":"laajenna/pienennä","locked":"henkilökunnan jäsen on estänyt tämän viestin muokkaamisen","gap":{"one":"näytä %{count} piilotettu vastaus","other":"näytä {{count}} piilotettua vastausta"},"notice":{"new_user":"Tämä on ensimmäinen kerta kun {{user}} kirjoittaa — toivotetaan hänet tervetulleeksi yhteisöömme!","returning_user":"Siitä on aikaa kun {{user}} on viimeksi nähty — hän oli viimeksi kirjoittanut {{time}}."},"unread":"Viesti on lukematta","has_replies":{"one":"{{count}} vastaus","other":"{{count}} vastausta"},"has_likes_title":{"one":"%{count} käyttäjä tykkäsi tästä viestistä","other":"{{count}} käyttäjää tykkäsi tästä viestistä"},"has_likes_title_only_you":"tykkäsit tästä viestistä","has_likes_title_you":{"one":"Sinä ja yksi toinen tykkäsi tästä viestistä","other":"Sinä ja {{count}} muuta tykkäsi tästä viestistä"},"errors":{"create":"Pahoittelut, viestin luonti ei onnistunut. Ole hyvä ja yritä uudelleen.","edit":"Pahoittelut, viestin muokkaus ei onnistunut. Ole hyvä ja yritä uudelleen.","upload":"Pahoittelut, tiedoston lähetys ei onnistunut. Ole hyvä ja yritä uudelleen.","file_too_large":"Pahoittelut, tiedosto on liian suuri (enimmäiskoko on {{max_size_kb}}kb). Mitäpä jos lataisit suuren tiedostosi johonkin pilvipalveluun ja sitten jakaisit linkin?","too_many_uploads":"Pahoittelut, voit ladata vain yhden tiedoston kerrallaan.","too_many_dragged_and_dropped_files":"Pahoittelut, voit ladata korkeintaan {{max}} tiedostoa kerrallaan.","upload_not_authorized":"Pahoittelut, tiedosto jota yrität ladata ei ole sallittu (sallitut laajennukset: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Pahoittelut, uudet käyttjät eivät saa ladata kuvia.","attachment_upload_not_allowed_for_new_user":"Pahoittelut, uudet käyttäjät eivät saa ladata liitteitä.","attachment_download_requires_login":"Pahoittelut, sinun täytyy kirjautua sisään voidaksesi ladata liitetiedostoja."},"abandon_edit":{"confirm":"Haluatko varmasti hylätä tekemäsi muutokset?","no_value":"Ei, säilytän","no_save_draft":"Ei, tallenna luonnos","yes_value":"Kyllä, hylkää muokkaus"},"abandon":{"confirm":"Oletko varma, että haluat hylätä viestisi?","no_value":"Ei, säilytä","no_save_draft":"Ei, tallenna luonnos","yes_value":"Kyllä, hylkää"},"via_email":"tämä viesti lähetettiin sähköpostitse","via_auto_generated_email":"tämä viesti saapui automaattisesti generoituna sähköpostina","whisper":"tämä viesti on yksityinen kuiskaus valvojille","wiki":{"about":"tämä viesti on wiki-viesti"},"archetypes":{"save":"Tallennusasetukset"},"few_likes_left":"Kiitos hyvän mielen levittämisestä! Sinulla on enää muutama tykkäys jäljellä tälle päivälle.","controls":{"reply":"aloita vastaamaan tähän viestiin","like":"tykkää viestistä","has_liked":"tykkäsit tästä viestistä","read_indicator":"jäsenet jotka ovat lukeneet tämän viestin","undo_like":"peru tykkäys","edit":"muokkaa viestiä","edit_action":"Muokkaa","edit_anonymous":"Pahoittelut, sinun täytyy ensin kirjautua sisään voidaksesi muokata tätä viestiä.","flag":"liputa tämä viesti tai lähetä käyttäjälle yksityisesti siihen liittyvä huomio","delete":"poista tämä viesti","undelete":"peru viestin poistaminen","share":"jaa linkki tähän viestiin","more":"Lisää","delete_replies":{"confirm":"Haluatko poistaa myös tähän viestiin liittyvät vastaukset?","direct_replies":{"one":"Kyllä, ja yksi suora vastaus","other":"Kyllä, ja {{count}} suoraa vastausta"},"all_replies":{"one":"Kyllä, ja yksi vastaus","other":"Kyllä, ja kaikki {{count}} vastausta"},"just_the_post":"Ei, vain tämä viesti"},"admin":"viestin ylläpitotoimet","wiki":"Tee wiki","unwiki":"Poista wiki","convert_to_moderator":"Lisää henkilökunnan taustaväri","revert_to_regular":"Poista henkilökunnan taustaväri","rebake":"Tee HTML uudelleen","unhide":"Poista piilotus","change_owner":"Vaihda omistajuutta","grant_badge":"Myönnä ansiomerkki","lock_post":"Lukitse viesti","lock_post_description":"estä kirjoittajaa muokkaamasta tätä viestiä","unlock_post":"Vapauta viesti","unlock_post_description":"salli kirjoittajan muokata viestiä","delete_topic_disallowed_modal":"Et saa poistaa tätä ketjua. Jos haluat sen poistetuksi, liputa se perustelujen kera, ja valvoja päättää poistamisesta.","delete_topic_disallowed":"et saa poistaa ketjua","delete_topic":"poista ketju","add_post_notice":"Lisää henkilökuntanootti","remove_post_notice":"Poista henkilökuntanootti","remove_timer":"poista ajastin"},"actions":{"flag":"Liputa","defer_flags":{"one":"Sivuuta lippu","other":"Sivuuta liput"},"undo":{"off_topic":"Peru lippu","spam":"Peru lippu","inappropriate":"Peru lippu","bookmark":"Peru kirjanmerkki","like":"Peru tykkäys"},"people":{"off_topic":"liputti tämän eksyvän aiheesta","spam":"liputti tämän roskapostiksi","inappropriate":"liputti tämän sopimattomaksi","notify_moderators":"ilmoitti valvojille","notify_user":"lähetti viestin","bookmark":"lisäsi tämän kirjanmerkkeihin","like":{"one":"tykkäsi tästä","other":"tykkäsivät tästä"},"read":{"one":"luki tämän","other":"lukivat tämän"},"like_capped":{"one":"ja {{count}} muu tykkäsi tästä","other":"ja {{count}} muuta tykkäsi tästä"},"read_capped":{"one":"ja {{count}} muu lukivat tämän","other":"ja {{count}} muuta lukivat tämän"}},"by_you":{"off_topic":"Liputit tämän eksyvän aiheesta","spam":"Liputit tämän roskapostiksi","inappropriate":"Liputit tämän sopimattomaksi","notify_moderators":"Liputit tämän valvojille tiedoksi","notify_user":"Lähetit viestin tälle käyttäjälle","bookmark":"Olet lisännyt viestin kirjainmerkkeihisi","like":"Tykkäsit tästä"}},"delete":{"confirm":{"one":"Oletko varma, että haluat poistaa viestin?","other":"Oletko varma, että haluat poistaa {{count}} viestiä?"}},"merge":{"confirm":{"one":"Oletko varma, että haluat yhdistää nämä viestit?","other":"Oletko varma, että haluat yhdistää nämä {{count}} viestiä?"}},"revisions":{"controls":{"first":"Ensimmäinen revisio","previous":"Edellinen revisio","next":"Seuraava revisio","last":"Viimeinen revisio","hide":"Piilota revisio","show":"Näytä revisio","revert":"Palaa tähän revisioon","edit_wiki":"Muokkaa wikiä","edit_post":"Muokkaa viestiä","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Näytä lisäykset ja poistot tekstin osana","button":"HTML"},"side_by_side":{"title":"Näytä muokkauksen versiot vierekkäin","button":"HTML"},"side_by_side_markdown":{"title":"Näytä viestien lähdekoodit vierekkäin","button":"Raaka"}}},"raw_email":{"displays":{"raw":{"title":"Näytä raaka sähköposti","button":"Raaka"},"text_part":{"title":"Näytä sähköpostin tekstiosa","button":"Teksti"},"html_part":{"title":"Näytä sähköpostin HTML-osa","button":"HTML"}}},"bookmarks":{"create":"Luo kirjanmerkki","created":"Luotu","name":"Nimi","actions":{"delete_bookmark":{"name":"Poista kirjanmerkki","description":"Poistaa kirjanmerkin profiilistasi ja kumoaa kaikki kirjanmerkkiin liittyvät muistutukset"}}}},"category":{"can":"voivat\u0026hellip; ","none":"(ei aluetta)","all":"Kaikki alueet","choose":"alue\u0026hellip;","edit":"Muokkaa","edit_dialog_title":"Muokkaa: %{categoryName}","view":"Katsele alueen ketjuja","general":"Yleistä","settings":"Asetukset","topic_template":"Ketjun sapluuna","tags":"Tunnisteet","tags_allowed_tags":"Rajaa nämä tunnisteet tälle alueelle:","tags_allowed_tag_groups":"Rajaa nämä tunnisteryhmät tälle alueelle:","tags_placeholder":"(Ei-pakollinen) lista sallituista tunnisteista","tags_tab_description":"Yllä määritellyt tunnisteet ja tunnisteryhmät ovat käytössä vain tällä alueella sekä muilla alueilla, jotka samalla tapaa ovat ne määritelleet. Muilla alueilla ne eivät ole käytettävissä.","tag_groups_placeholder":"(Ei-pakollinen) lista sallituista tunnisteryhmistä","manage_tag_groups_link":"Hallitse tunnisteryhmiä tästä.","allow_global_tags_label":"Salli myös muut tunnisteet","tag_group_selector_placeholder":"(Ei-pakollinen) tunnisteryhmä","required_tag_group_description":"Edellytä, että uudella ketjulla on tunnisteita tunnisteryhmästä:","min_tags_from_required_group_label":"Tunnisteiden määrä:","required_tag_group_label":"Tunnisteryhmä:","topic_featured_link_allowed":"Salli ketjulinkit tällä alueella","delete":"Poista alue","create":"Uusi alue","create_long":"Luo uusi alue","save":"Tallenna","slug":"Alueen lyhenne","slug_placeholder":"(Ei-pakollinen) url-lyhenne","creation_error":"Alueen luonnissa tapahtui virhe.","save_error":"Alueen tallennuksessa tapahtui virhe.","name":"Alueen nimi","description":"Kuvaus","topic":"alueen kuvausketju","logo":"Alueen logo","background_image":"Alueen taustakuva","badge_colors":"Alueen tunnusvärit","background_color":"Taustaväri","foreground_color":"Edustan väri","name_placeholder":"Yksi tai kaksi sanaa enimmillään","color_placeholder":"Web-väri","delete_confirm":"Oletko varma, että haluat poistaa tämän alueen?","delete_error":"Alueen poistossa tapahtui virhe.","list":"Listaa alueet","no_description":"Lisää alueelle kuvaus.","change_in_category_topic":"Muokkaa kuvausta","already_used":"Tämä väri on jo käytössä toisella alueella","security":"Turvallisuus","special_warning":"Varoitus: Tämä on valmiiksi luotu alue, ja sen turvallisuusasetuksia ei voi muuttaa. Jos et näe käyttöä alueelle, älä muuta sen tarkoitusta vaan poista se.","uncategorized_security_warning":"Tämä alue on erityinen. Se on tarkoitettu säilytyspaikaksi ketjuille, joilla ei ole aluetta; sille ei voi määritellä turvallisuusasetuksia.","uncategorized_general_warning":"Tämä alue on erityinen. Se on oletusalue uusille ketjuille, joille ei ole valittu aluetta. Jos et kaipaa tätä ja haluat mieluummin pakottaa valitsemaan alueen, \u003ca href=\"%{settingLink}\"\u003eota asetus pois käytöstä täällä\u003c/a\u003e. Jos haluat vaihtaa nimeä tai kuvasta, mene \u003ca href=\"%{customizeLink}\"\u003eMukauta / Tekstit\u003c/a\u003e.","pending_permission_change_alert":"Et ole lisännyt ryhmää %{group} tälle alueelle; lisää klikkaamalla tätä.","images":"Kuvat","email_in":"Saapuvan postin sähköpostiosoite:","email_in_allow_strangers":"Hyväksy sähköpostit anonyymeiltä käyttäjiltä joilla ei ole tiliä","email_in_disabled":"Uusien ketjujen aloittaminen sähköpostitse on otettu pois käytöstä sivuston asetuksissa. Salliaksesi uusien ketjujen luomisen sähköpostilla, ","email_in_disabled_click":"ota käyttöön \"email in\" asetus.","mailinglist_mirror":"Alue jäljittelee postituslistaa","show_subcategory_list":"Näytä lista tytäralueista ketjujen yläpuolella tällä alueella.","num_featured_topics":"Kuinka monta ketjua näytetään Keskustelualueet-sivulla:","subcategory_num_featured_topics":"Kuinka monta ketjua näytetään emoalueen sivulla:","all_topics_wiki":"Tee uusista ketjuista wiki-viestejä oletuksena.","subcategory_list_style":"Tytäraluelistan tyyli:","sort_order":"Ketjulistaus järjestetään:","default_view":"Oletuslistaus:","default_top_period":"Kuumat-listauksen oletusajanjakso:","allow_badges_label":"Salli ansiomerkkien myöntäminen tältä alueelta","edit_permissions":"Muokkaa oikeuksia","reviewable_by_group":"Henkilökunnan lisäksi viestejä ja lippuja voi tällä alueella käsitellä:","review_group_name":"ryhmän nimi","require_topic_approval":"Edellytä valvojan hyväksyntää kaikille uusille ketjuille","require_reply_approval":"Edellytä valvojan hyväksyntää kaikille uusille vastauksille","this_year":"tänä vuonna","position":"Sijainti alueet-sivulla:","default_position":"Oletuspaikka","position_disabled":"Alueet näytetään aktiivisuusjärjestyksessä. Muokataksesi järjestystä,","position_disabled_click":"ota käyttöön \"pysyvä aluejärjestys\" asetuksista.","minimum_required_tags":"Kuinka monta tunnistetta ketjulla täytyy vähintään olla:","parent":"Emoalue","num_auto_bump_daily":"Kuinka monta avointa ketjua nostetaan automaattisesti päivittäin:","navigate_to_first_post_after_read":"Siirry ensimmäiseen viestiin, kun kaikki ketjut on luettu","notifications":{"watching":{"title":"Tarkkaile","description":"Tarkkailet kaikkia ketjuja näillä alueilla. Saat ilmoituksen jokaisesta uudesta viestistä missä tahansa ketjussa, ja uusien vastausten määrä näytetään."},"watching_first_post":{"title":"Tarkkaile uusia ketjuja","description":"Saat ilmoituksia uusista tämän alueen ketjuista, muttet ketjuihin tulevista vastauksista."},"tracking":{"title":"Seuraa","description":"Seuraat kaikkia ketjuja näillä alueilla. Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa sinulle, ja uusien vastausten määrä näytetään."},"regular":{"title":"Tavallinen","description":"Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa sinulle."},"muted":{"title":"Vaimennettu","description":"Et saa ilmoituksia uusista ketjuista näillä alueilla, eivätkä ne näy tuoreimmissa."}},"search_priority":{"label":"Hakuprioriteetti","options":{"normal":"Normaali","ignore":"Sivuuta","very_low":"Erittäin matala","low":"Matala","high":"Korkea","very_high":"Erittäin korkea"}},"sort_options":{"default":"oletus","likes":"Tykkäykset","op_likes":"Avausviestin tykkäykset","views":"Katselut","posts":"Viestit","activity":"Toiminta","posters":"Kirjoittajat","category":"Alue","created":"Luomisaika","votes":"Äänet"},"sort_ascending":"Nouseva","sort_descending":"Laskeva","subcategory_list_styles":{"rows":"Rivit","rows_with_featured_topics":"Rivit ja ketjuja","boxes":"Laatikot","boxes_with_featured_topics":"Laatikot ja ketjuja"},"settings_sections":{"general":"Yleistä","moderation":"Valvonta","appearance":"Ulkoasu","email":"Sähköposti"}},"flagging":{"title":"Kiitos avustasi yhteisön hyväksi!","action":"Liputa viesti","take_action":"Ryhdy toimiin","notify_action":"Viesti","official_warning":"Virallinen varoitus","delete_spammer":"Poista roskapostittaja","yes_delete_spammer":"Kyllä, poista roskapostittaja","ip_address_missing":"-","hidden_email_address":"(piilotettu)","submit_tooltip":"Toimita lippu","take_action_tooltip":"Saavuta liputusraja välittömästi; ei tarvetta odottaa muiden käyttäjien liputuksia.","cant":"Pahoittelut, et pysty liputtamaan tätä viestiä tällä hetkellä.","notify_staff":"Ilmoita henkilökunnalle yksityisesti","formatted_name":{"off_topic":"Se eksyy aiheesta","inappropriate":"Se on sopimaton","spam":"Se on roskapostia"},"custom_placeholder_notify_user":"Esitä asiasi ymmärrettävästi, ole rakentava ja kohtelias.","custom_placeholder_notify_moderators":"Kerro ymmärrettävästi ja selvästi, mistä olet huolestunut ja lisää viestiin oleelliset esimerkit ja linkit, jos mahdollista.","custom_message":{"at_least":{"one":"syötä vähintään %{count} merkki","other":"syötä vähintään {{count}} merkkiä"},"more":{"one":"Vielä %{count}...","other":"Vielä {{count}}..."},"left":{"one":"%{count} jäljellä","other":"{{count}} jäljellä"}}},"flagging_topic":{"title":"Kiitos avustasi yhteisön hyväksi!","action":"Liputa ketju","notify_action":"Viesti"},"topic_map":{"title":"Ketjun tiivistelmä","participants_title":"Useimmin kirjoittaneet","links_title":"Suositut linkit","links_shown":"näytä enemmän linkkejä...","clicks":{"one":"%{count} klikkaus","other":"%{count} klikkausta"}},"post_links":{"about":"laajenna lisää linkkejä tähän viestiin","title":{"one":"%{count} lisää","other":"%{count} lisää"}},"topic_statuses":{"warning":{"help":"Tämä on virallinen varoitus."},"bookmarked":{"help":"Olet lisännyt ketjun kirjanmerkkeihisi"},"locked":{"help":"Tämä ketju on suljettu; siihen ei voi enää vastata."},"archived":{"help":"Tämä ketju on arkistoitu; se on jäädytetty eikä sitä voi muuttaa"},"locked_and_archived":{"help":"Tämä ketju on suljettu ja arkistoitu, sihen ei voi enää vastata eikä sitä muuttaa"},"unpinned":{"title":"Kiinnitys poistettu","help":"Ketjun kiinnitys on poistettu sinulta; se näytetään tavallisessa järjestyksessä."},"pinned_globally":{"title":"Kiinnitetty koko palstalle","help":"Tämä ketju on kiinnitetty koko palstalle; se näytetään tuoreimpien ja oman alueensa ylimpänä"},"pinned":{"title":"Kiinnitetty","help":"Tämä ketju on kiinnitetty sinulle; se näytetään alueensa ensimmäisenä"},"unlisted":{"help":"Tämä ketju on poistettu listauksista; sitä ei näytetä ketjulistauksissa vaan siihen pääsee vain suoran linkin kautta"},"personal_message":{"title":"Tämä ketju on yksityiskeskustelu","help":"Tämä ketju on yksityiskeskustelu"}},"posts":"Viestejä","posts_long":"tässä ketjussa on {{number}} viestiä","original_post":"Aloitusviesti","views":"Katseluita","views_lowercase":{"one":"katselu","other":"katselut"},"replies":"Vastauksia","views_long":{"one":"ketjua on katseltu yhden kerran","other":"ketjua on katseltu {{number}} kertaa"},"activity":"Toiminta","likes":"Tykkäykset","likes_lowercase":{"one":"tykkäys","other":"tykkäykset"},"likes_long":"tässä ketjussa on {{number}} tykkäystä","users":"Käyttäjät","users_lowercase":{"one":"käyttäjä","other":"käyttäjät"},"category_title":"Alue","history":"Historia","changed_by":"käyttäjältä {{author}}","raw_email":{"title":"Saapuva sähköposti","not_available":"Ei käytettävissä!"},"categories_list":"Lista alueista","filters":{"with_topics":"%{filter} ketjut","with_category":"%{filter} %{category} ketjut","latest":{"title":"Tuoreimmat","title_with_count":{"one":"Tuoreimmat (%{count})","other":"Tuoreimmat ({{count}})"},"help":"ketjut, joissa on viimeaikaisia viestejä"},"read":{"title":"Luetut","help":"lukemasi ketjut, lukemisjärjestyksessä"},"categories":{"title":"Keskustelualueet","title_in":"Alue - {{categoryName}}","help":"kaikki ketjut alueen mukaan järjestettynä"},"unread":{"title":"Lukematta","title_with_count":{"one":"Lukematta (%{count})","other":"Lukematta ({{count}})"},"help":"ketjut, joita seuraat tai tarkkailet tällä hetkellä ja joissa on lukemattomia viestejä","lower_title_with_count":{"one":"%{count} lukematta","other":"{{count}} lukematta"}},"new":{"lower_title_with_count":{"one":"%{count} uusi","other":"{{count}} uutta"},"lower_title":"uusi","title":"Uudet","title_with_count":{"one":"Uudet (%{count})","other":"Uudet ({{count}})"},"help":"viime päivinä aloitetut ketjut"},"posted":{"title":"Viestini","help":"ketjut, joihin olet kirjoittanut"},"bookmarks":{"title":"Kirjanmerkit","help":"ketjut, jotka olet merkinnyt kirjanmerkillä"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (%{count})","other":"{{categoryName}} ({{count}})"},"help":"Tuoreimmat alueella {{categoryName}}"},"top":{"title":"Kuumat","help":"Aktiivisimmat ketjut viimeisen vuoden, kuukauden ja päivän ajalta","all":{"title":"Kaikkina aikoina"},"yearly":{"title":"Vuosittain"},"quarterly":{"title":"Vuosineljännettäin"},"monthly":{"title":"Kuukausittain"},"weekly":{"title":"Viikoittain"},"daily":{"title":"Päivittäin"},"all_time":"Kaikkina aikoina","this_year":"Vuosi","this_quarter":"Vuosineljännes","this_month":"Kuukausi","this_week":"Viikko","today":"Tänään","other_periods":"katso kuumat"},"votes":{"title":"Äänet","help":"ketjut, joilla on eniten ääniä"}},"browser_update":"Valitettavasti \u003ca href=\"https://www.discourse.org/faq/#browser\"\u003eselaimesi on niin vanha, ettei sivusto toimi sillä\u003c/a\u003e. \u003ca href=\"https://browsehappy.com\"\u003ePäivitä selaimesi\u003c/a\u003e.","permission_types":{"full":"Luoda / Vastata / Nähdä","create_post":"Vastata / Nähdä","readonly":"Nähdä"},"lightbox":{"download":"lataa","previous":"Edellinen (vasen nuolinäppäin)","next":"Seuraava (oikea nuolinäppäin)","counter":"%curr% / %total%","close":"Sulje (Esc)","content_load_error":"\u003ca href=\"%url%\"\u003eSisällön\u003c/a\u003e lataaminen ei onnistunut.","image_load_error":"\u003ca href=\"%url%\"\u003eKuvan\u003c/a\u003e lataaminen ei onnistunut."},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":", ","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1} tai %{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1} %{shortcut2}","title":"Näppäinoikotiet","jump_to":{"title":"Siirry","home":"%{shortcut} Aloitussivulle","latest":"%{shortcut} Tuoreimmat","new":"%{shortcut} Uudet","unread":"%{shortcut} Lukemattomat","categories":"%{shortcut} Alueet","top":"%{shortcut} Kuumat","bookmarks":"%{shortcut} Kirjanmerkit","profile":"%{shortcut} Käyttäjäprofiili","messages":"%{shortcut} Viestit","drafts":"%{shortcut} Luonnokset"},"navigation":{"title":"Navigointi","jump":"%{shortcut} Siirry viestiin #","back":"%{shortcut} Takaisin","up_down":"%{shortcut} Siirrä valintaa \u0026uarr; \u0026darr;","open":"%{shortcut} Avaa valittu ketju","next_prev":"%{shortcut} Seuraava/edellinen valinta","go_to_unread_post":"%{shortcut} Mene ensimmäiseen lukemattomaan viestiin"},"application":{"title":"Ohjelma","create":"%{shortcut} Aloita uusi ketju","notifications":"%{shortcut} Avaa ilmoitukset","hamburger_menu":"%{shortcut} Avaa hampurilaisvalikko","user_profile_menu":"%{shortcut} Avaa käyttäjävalikko","show_incoming_updated_topics":"%{shortcut} Näytä päivttyneet ketjut","search":"%{shortcut} Haku","help":"%{shortcut} Näytä näppäimistöoikotiet","dismiss_new_posts":"%{shortcut} Unohda Uudet/Viestit","dismiss_topics":"%{shortcut} Unohda ketjut","log_out":"%{shortcut} Kirjaudu ulos"},"composing":{"title":"Kirjoittaminen","return":"%{shortcut} Palaa viestikenttään","fullscreen":"%{shortcut} Koko ruudun kirjoitustila"},"actions":{"title":"Toiminnot","bookmark_topic":"%{shortcut} Aseta kirjanmerkkeihin/poista","pin_unpin_topic":"%{shortcut} Kiinnitä/Poista ketjun kiinnitys","share_topic":"%{shortcut} Jaa ketju","share_post":"%{shortcut} Jaa viesti","reply_as_new_topic":"%{shortcut} Vastaa aihetta sivuavassa ketjussa","reply_topic":"%{shortcut} Vastaa ketjuun","reply_post":"%{shortcut} Vastaa viestiin","quote_post":"%{shortcut} Lainaa viesti","like":"%{shortcut} Tykkää viestistä","flag":"%{shortcut} Liputa viesti","bookmark":"%{shortcut} Lisää viesti kirjanmerkkeihin","edit":"%{shortcut} Muokkaa viestiä","delete":"%{shortcut} Poista viesti","mark_muted":"%{shortcut} Vaimenna ketju","mark_regular":"%{shortcut} Tavallinen (oletus) ketju","mark_tracking":"%{shortcut} Seuraa ketjua","mark_watching":"%{shortcut} Tarkkaile ketjua","print":"%{shortcut} Tulosta ketju","defer":"%{shortcut} Lykkää ketjua","topic_admin_actions":"%{shortcut} Avaa ketjun ylläpitotyökalut"}},"badges":{"earned_n_times":{"one":"Ansaitsi tämän ansiomerkin yhden kerran","other":"Ansaitsi tämän ansiomerkin %{count} kertaa"},"granted_on":"Myönnetty %{date}","others_count":"Muita, joilla on tämä ansiomerkki (%{count})","title":"Ansiomerkit","allow_title":"Voit käyttää tätä ansiomerkkiä tittelinä","multiple_grant":"Voit ansaita tämän useasti","badge_count":{"one":"%{count} ansiomerkki","other":"%{count} ansiomerkkiä"},"more_badges":{"one":"+%{count} Lisää","other":"+%{count} Lisää"},"granted":{"one":"%{count} myönnetty","other":"%{count} myönnettyä"},"select_badge_for_title":"Valitse tittelisi ansiomerkeistä","none":"(ei mitään)","successfully_granted":"Ansiomerkin %{badge} myöntäminen käyttäjälle %{username} onnistui","badge_grouping":{"getting_started":{"name":"Ensiaskeleet"},"community":{"name":"Yhteisö"},"trust_level":{"name":"Luottamustaso"},"other":{"name":"Muut"},"posting":{"name":"Kirjoittaminen"}}},"tagging":{"all_tags":"Kaikki tunnisteet","other_tags":"Muut tunnisteet","selector_all_tags":"kaikki tunnisteet","selector_no_tags":"ei tunnisteita","changed":"muutetut tunnisteet","tags":"Tunnisteet","choose_for_topic":"ei-pakolliset tunnisteet","info":"Tietoa","default_info":"Tätä tunnistetta ei ole rajattu millekään alueelle eikä sillä ole synonyymejä.","category_restricted":"Tämä tunniste on rajoitettu alueille, joille sinulla ei ole pääsyoikeutta.","synonyms":"Synonyymit","synonyms_description":"Kun näitä tunnisteita käytetään, ne korvataan pääsynonyymillä \u003cb\u003e%{base_tag_name}\u003c/b\u003e.","tag_groups_info":{"one":"Tunniste kuuluu ryhmään \"{{tag_groups}}\".","other":"Tunniste kuuluu näihin ryhmiin: {{tag_groups}}"},"category_restrictions":{"one":"Sitä voi käyttää vain tällä alueella:","other":"Sitä voi käyttää vain näillä alueilla:"},"edit_synonyms":"Hallinnoi synonyymejä","add_synonyms_label":"Lisää synonyymejä:","add_synonyms":"Lisää","add_synonyms_explanation":{"one":"Kaikkialla missä tätä tunnistetta käytetään, vaihdetaan tunnisteeksi \u003cb\u003e%{tag_name}\u003c/b\u003e. Haluatko varmasti tehdä tämän vaihdoksen?","other":"Kaikkialla missä näitä tunnisteita nykyisin käytetään, vaihdetaan tunnisteeksi \u003cb\u003e%{tag_name}\u003c/b\u003e. Haluatko varmasti tehdä tämän vaihdoksen?"},"add_synonyms_failed":"Näitä tunnisteita ei voitu lisätä synonyymeiksi: \u003cb\u003e%{tag_names}\u003c/b\u003e. Varmistu, ettei niillä itsellään ole synonyymejä ja ettei ne ole synonyymejä muulle tunnisteelle.","remove_synonym":"Poista synonyymi","delete_synonym_confirm":"Haluatko varmasti poistaa synonyymin \"%{tag_name}\"?","delete_tag":"Poista tunniste","delete_confirm":{"one":"Haluatko varmasti poistaa tunnisteen, mikä poistaa sen myös yhdeltä ketjulta, jolla tunniste on?","other":"Haluatko varmasti poistaa tunnisteen, mikä poistaa sen myös {{count}} ketjulta, joilla tunniste on?"},"delete_confirm_no_topics":"Haluatko varmasti poistaa tunnisteen?","delete_confirm_synonyms":{"one":"Sen synonyymi poistetaan myös.","other":"Sen {{count}} muuta synonyymiä poistetaan myös."},"rename_tag":"Uudelleennimeä tunniste","rename_instructions":"Valitse uusi nimi tälle tunnisteelle:","sort_by":"Järjestä:","sort_by_count":"lukumäärä","sort_by_name":"nimi","manage_groups":"Hallinnoi tunnisteryhmiä","manage_groups_description":"Määrittele ryhmiä tunnisteiden järjestämiseksi","upload":"Lataa tunnisteita","upload_description":"Luo iso joukko tunnisteita kerralla lähettämällä CSV-tiedosto.","upload_instructions":"Yksi per rivi. Mukana voi olla tunnisteryhmä, tällöin muoto on \"tunnisteen_nimi,tunnisteryhmä\".","upload_successful":"Tunnisteiden lisäys onnistui","delete_unused_confirmation":{"one":"%{count} tunniste poistetaan: %{tags}","other":"%{count} tunnistetta poistetaan: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} ja %{count} muu","other":"%{tags} ja %{count} muuta"},"delete_unused":"Poista käyttämättömät tunnisteet","delete_unused_description":"Poista kaikki tunnisteet jotka eivät ole jonkun ketjun tai yksityiskeskustelun käytössä","cancel_delete_unused":"Peru","filters":{"without_category":"%{filter} %{tag} ketjut","with_category":"%{filter} %{tag} ketjut alueella %{category}","untagged_without_category":"%{filter} ketjut joilla ei tunnisteita","untagged_with_category":"%{filter} ketjut joilla ei tunnisteita alueella %{category}"},"notifications":{"watching":{"title":"Tarkkaile","description":"Ketjut joilla on tämä tunniste asetetaan automaattisesti tarkkailuun. Saat ilmoituksen kaikista uusista viesteistä ja ketjuista ja uusien viestien lukumäärä näytetään ketjun otsikon vieressä.\n "},"watching_first_post":{"title":"Tarkkaile uusia ketjuja","description":"Saat ilmoituksia uusista ketjuista, joilla on tämä tunniste, muttet ketjuihin tulevista vastauksista."},"tracking":{"title":"Seuraa","description":"Seuraat automaattisesti ketjuja joilla on tämä tunniste. Uusien ja lukemattomien viestien lukumäärä näytetään ketjun yhteydessä."},"regular":{"title":"Tavallinen","description":"Saat ilmoituksen jos joku mainitsee @nimesi tai vastaa viestiisi."},"muted":{"title":"Vaimennettu","description":"Et saa ilmoituksia ketjusta, jolla on tämä tunniste, eivätkä ne näy lukemattomissa."}},"groups":{"title":"Tunnisteryhmät","about":"Lisää tunnisteita ryhmiin, jotta niitä on helpompi hallita","new":"Uusi ryhmä","tags_label":"Tunnisteet tässä ryhmässä","tags_placeholder":"tunnisteet","parent_tag_label":"Emotunniste:","parent_tag_placeholder":"Ei pakollinen","parent_tag_description":"Tämän ryhmän tunnisteita voi käyttää vain, jos emotunniste on asetettu","one_per_topic_label":"Rajoita tästä ryhmästä yhteen tunnisteeseen per ketju","new_name":"Uusi ryhmä tunnisteita","name_placeholder":"Tunnisteryhmän nimi","save":"Tallenna","delete":"Poista","confirm_delete":"Oletko varma, että haluat poistaa tämän tunnisteryhmän?","everyone_can_use":"Kuka vain voi käyttää tunnisteita","usable_only_by_staff":"Tunnisteet näkyvät kaikille, mutta vain henkilökunta voi käyttää niitä","visible_only_to_staff":"Tunnisteet näkyvät vain henkilökunnalle"},"topics":{"none":{"unread":"Sinulla ei ole lukemattomia ketjuja.","new":"Sinulle uusia ketjuja ei ole.","read":"Et ole lukenut vielä yhtään yhtään ketjua.","posted":"Et ole kirjoittanut vielä yhteenkään ketjuun.","latest":"Tuoreimpia ketjuja ei ole.","bookmarks":"Et ole vielä merkinnyt kirjanmerkkejä.","top":"Kuumia ketjuja ei ole."},"bottom":{"latest":"Tuoreimpia ketjuja ei ole enempää.","posted":"Ketjuja, joihin olet kirjoittanut ei ole enempää.","read":"Luettuja ketjuja ei ole enempää.","new":"Uusia ketjuja ei ole enempää.","unread":"Ketjuja ei ole enempää lukematta.","top":"Kuumia ketjuja ei ole enempää.","bookmarks":"Merkattuja ketjuja ei ole enempää."}}},"invite":{"custom_message":"Tee kutsusta persoonallisempi kirjoittamalla \u003ca href\u003eyksilöllinen viesti\u003c/a\u003e.","custom_message_placeholder":"Kirjoita henkilökohtainen viestisi","custom_message_template_forum":"Hei, sinun pitäisi liittyä tälle palstalle!","custom_message_template_topic":"Hei, ajattelin, että voisit tykätä tästä ketjusta!"},"forced_anonymous":"Rajun kuormituksen vuoksi tämä näytetään väliaikaisesti kaikille niin kuin uloskirjautunut käyttäjä näkee sen.","safe_mode":{"enabled":"Vikasietotila on nyt päällä, sulje selainikkuna lopettaaksesi"},"poll":{"voters":{"one":"äänestäjä","other":"äänestäjää"},"total_votes":{"one":"ääni","other":"ääntä"},"average_rating":"Keskiarvo: \u003cstrong\u003e%{average}\u003c/strong\u003e","public":{"title":"Äänet ovat \u003cstrong\u003ejulkisia\u003c/strong\u003e."},"results":{"groups":{"title":"Täytyy olla ryhmien %{groups} jäsen, jotta voi äänestää tässä äänestyksessä."},"vote":{"title":"Näet äänet, kun \u003cstrong\u003eolet äänestänyt\u003c/strong\u003e."},"closed":{"title":"Tulokset näytetään äänestyksen \u003cstrong\u003esulkeuduttua\u003c/strong\u003e."},"staff":{"title":"Tulokset näytetään vain \u003cstrong\u003ehenkilökunnan\u003c/strong\u003e jäsenille. "}},"multiple":{"help":{"at_least_min_options":{"one":"Valitse vähintään \u003cstrong\u003e%{count}\u003c/strong\u003e vaihtoehto","other":"Valotse vähintään \u003cstrong\u003e%{count}\u003c/strong\u003e vaihtoehtoa"},"up_to_max_options":{"one":"Valitse enintään \u003cstrong\u003e%{count}\u003c/strong\u003e vaihtoehto","other":"Valitse enintään \u003cstrong\u003e%{count}\u003c/strong\u003e vaihtoehtoa"},"x_options":{"one":"Valitse \u003cstrong\u003e%{count}\u003c/strong\u003e vaihtoehto","other":"Valitse \u003cstrong\u003e%{count}\u003c/strong\u003e vaihtoehtoa"},"between_min_and_max_options":"Valitse \u003cstrong\u003e%{min}\u003c/strong\u003e-\u003cstrong\u003e%{max}\u003c/strong\u003e vaihtoehtoa"}},"cast-votes":{"title":"Antakaa äänenne","label":"Äänestä nyt!"},"show-results":{"title":"Näytä äänestystulos","label":"Näytä tulos"},"hide-results":{"title":"Palaa äänestysvalintaasi","label":"Näytä äänestys"},"group-results":{"title":"Lajittele äänet käyttäjäkentän perusteella","label":"Näytä erittely"},"ungroup-results":{"title":"Yhdistä kaikki äänet","label":"Piilota erittely"},"export-results":{"title":"Vie äänestystulos","label":"Vie"},"open":{"title":"Avaa äänestys","label":"Avaa","confirm":"Avataanko äänestys?"},"close":{"title":"Sulje äänestys","label":"Sulje","confirm":"Suljetaanko äänestys?"},"automatic_close":{"closes_in":"Sulkeutuu \u003cstrong\u003e%{timeLeft}\u003c/strong\u003e kuluttua","age":"Sulkeutui \u003cstrong\u003e%{age}\u003c/strong\u003e"},"error_while_toggling_status":"Pahoittelut, äänestyksen tilaa muutettaessa tapahtui virhe.","error_while_casting_votes":"Pahoittelut, ääntä annettaessa tapahtui virhe.","error_while_fetching_voters":"Pahoittelut, äänestäneiden näyttämisessä tapahtui virhe.","error_while_exporting_results":"Pahoittelut, äänestystuloksen vienti epäonnistui.","ui_builder":{"title":"Luo äänestys","insert":"Lisää äänestys","help":{"options_count":"Syötä ainakin 1 vaihtoehto","invalid_values":"Vähimmäisarvon täytyy olla enimmäisarvoa pienempi.","min_step_value":"Askelvälin on oltava vähintään 1"},"poll_type":{"label":"Tyyppi","regular":"Valitaan yksi","multiple":"Valitaan useita","number":"Numeroarviointi"},"poll_result":{"label":"Tulokset","always":"Näkyvät aina","vote":"Kun on äänestänyt","closed":"Kun äänestys suljettu","staff":"Vain henkilökunta"},"poll_groups":{"label":"Sallitut ryhmät"},"poll_chart_type":{"label":"Kuvaajan tyyppi"},"poll_config":{"max":"Enint.","min":"Väh.","step":"Askelväli"},"poll_public":{"label":"Näytä äänestäneet"},"poll_options":{"label":"Syötä yksi äänestysvaihtoehto riviä kohden"},"automatic_close":{"label":"Sulje äänestys ajastetusti"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Aloita alkeiskurssi kaikkien uusien käyttäjien kanssa","welcome_message":"Lähetä kaikille uusille käyttäjille tervetuloviesti, jossa on pikaopas palstan käyttöön"}},"discourse_local_dates":{"relative_dates":{"today":"Tänään %{time}","tomorrow":"Huomenna %{time}","yesterday":"Eilen %{time}","countdown":{"passed":"päivämäärä on mennyt"}},"title":"Lisää päivämäärä / aika","create":{"form":{"insert":"Lisää","advanced_mode":"Lisäasetukset","simple_mode":"Piilota lisäasetukset","format_description":"Missä formaatissa aika näytetään käyttäjälle. Näytä käyttäjän aikavyöhyke sanallisesti (esim. Europe/Paris) lisäämällä \"\\T\\Z\".","timezones_title":"Näytettävät aikavyöhykkeet","timezones_description":"Aikavyöhykkeitä käytetään esikatselussa sekä varana virhetilanteissa.","recurring_title":"Toistuvuus","recurring_description":"Määrittele tapahtuman toistuvuus. Voit myös manuaalisesti muokata toistuvuusparametriä, jonka lomake viestiin luo. Käytä näitä avainsanoja: years, quarters, months, weeks, days, hours, minutes, seconds, milliseconds.","recurring_none":"Ei toistuvuutta","invalid_date":"Päiväys ei kelpaa. Tarkista päivämäärä ja aika.","date_title":"Päivämäärä","time_title":"Aika","format_title":"Päiväysformaatti","timezone":"Aikavyöhyke","until":"Asti","recurring":{"every_day":"Joka päivä","every_week":"Joka viikko","every_two_weeks":"Joka toinen viikko","every_month":"Joka kuukausi","every_two_months":"Joka toinen kuukausi","every_three_months":"Joka kolmas kuukausi","every_six_months":"Puolen vuoden välein","every_year":"Kerran vuodessa"}}}},"details":{"title":"Piilota yksityiskohtia"},"presence":{"replying":"kirjoittaa vastausta","editing":"muokkaa viestiä","replying_to_topic":{"one":"kirjoittaa vastausta","other":"kirjoittavat vastausta"}},"voting":{"title":"Äänestys","reached_limit":"Sinulla ei ole enempää ääniä, poista antamasi ääni!","list_votes":"Kaikki antamasi äänet","votes_nav_help":"ketjut, joilla on eniten ääniä","voted":"Äänestit tätä ketjua","allow_topic_voting":"Salli käyttäjien antaa ääniä ketjuille tällä alueella","vote_title":"Ääni","vote_title_plural":"Äänet","voted_title":"Äänestit","voting_closed_title":"Suljettu","voting_limit":"Yläraja","votes_left":{"one":"Sinulla on {{count}} ääni jäljellä, katso \u003ca href='{{path}}'\u003ekaikki äänesi\u003c/a\u003e.","other":"Sinulla on {{count}} ääntä jäljellä, katso \u003ca href='{{path}}'\u003ekaikki äänesi\u003c/a\u003e."},"votes":{"one":"{{count}} ääni","other":"{{count}} ääntä"},"anonymous_button":{"one":"Ääni","other":"Äänet"},"remove_vote":"Poista ääni"},"adplugin":{"advertisement_label":"MAINOS"},"docker":{"upgrade":"Discourse-asennuksesi ei ole ajan tasalla.","perform_upgrade":"Klikkaa tästä päivittääksesi."}}},"zh_CN":{"js":{"dates":{"long_no_year":"M[月]D[日] HH:mm"},"bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","reminders":{"start_of_next_business_week":"下周一","last_custom":"最近","today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"directory":{"last_updated":"最近更新："},"user":{"use_current_timezone":"使用现在的时区","second_factor":{"totp":{"name_and_code_required_error":"你必须提供你的身份验证器应用的名称和代码。"},"security_key":{"name_required_error":"你必须提供安全密钥的名称。"}},"change_avatar":{"gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e，基于","gravatar_title":"在{{gravatarName}}网站修改你的头像","gravatar_failed":"我们无法找到此电子邮件的{{gravatarName}}。","refresh_gravatar_title":"刷新你的{{gravatarName}}"},"email":{"sso_override_instructions":"电子邮件地址可以通过SSO登录来更新。"},"invite_code":{"title":"邀请码","instructions":"账户注册需要邀请码"}},"modal":{"dismiss_error":"忽略错误"},"notifications":{"tooltip":{"high_priority":{"other":"%{count}个未读的高优先级通知"}},"titles":{"bookmark_reminder":"收藏提醒","bookmark_reminder_with_name":"收藏提醒 - %{name}"}},"topic":{"topic_status_update":{"num_of_days":"天数"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}}},"post":{"bookmarks":{"edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"keyboard_shortcuts_help":{"bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}}}},"en":{"js":{"user":{"change_password":{"emoji":"lock emoji"}},"local_time":"Local Time","email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"notifications":{"tooltip":{"high_priority":{"one":"%{count} unread high priority notification"}}},"topic":{"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions_without_old_user":{"one":"Please choose a new owner for the post"}}},"post":{"controls":{"publish_page":"Page Publishing"}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'fi';
I18n.pluralizationRules.fi = MessageFormat.locale.fi;
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


    var numbersPast = 'nolla yksi kaksi kolme neljä viisi kuusi seitsemän kahdeksan yhdeksän'.split(' '),
        numbersFuture = [
            'nolla', 'yhden', 'kahden', 'kolmen', 'neljän', 'viiden', 'kuuden',
            numbersPast[7], numbersPast[8], numbersPast[9]
        ];
    function translate(number, withoutSuffix, key, isFuture) {
        var result = '';
        switch (key) {
            case 's':
                return isFuture ? 'muutaman sekunnin' : 'muutama sekunti';
            case 'ss':
                return isFuture ? 'sekunnin' : 'sekuntia';
            case 'm':
                return isFuture ? 'minuutin' : 'minuutti';
            case 'mm':
                result = isFuture ? 'minuutin' : 'minuuttia';
                break;
            case 'h':
                return isFuture ? 'tunnin' : 'tunti';
            case 'hh':
                result = isFuture ? 'tunnin' : 'tuntia';
                break;
            case 'd':
                return isFuture ? 'päivän' : 'päivä';
            case 'dd':
                result = isFuture ? 'päivän' : 'päivää';
                break;
            case 'M':
                return isFuture ? 'kuukauden' : 'kuukausi';
            case 'MM':
                result = isFuture ? 'kuukauden' : 'kuukautta';
                break;
            case 'y':
                return isFuture ? 'vuoden' : 'vuosi';
            case 'yy':
                result = isFuture ? 'vuoden' : 'vuotta';
                break;
        }
        result = verbalNumber(number, isFuture) + ' ' + result;
        return result;
    }
    function verbalNumber(number, isFuture) {
        return number < 10 ? (isFuture ? numbersFuture[number] : numbersPast[number]) : number;
    }

    var fi = moment.defineLocale('fi', {
        months : 'tammikuu_helmikuu_maaliskuu_huhtikuu_toukokuu_kesäkuu_heinäkuu_elokuu_syyskuu_lokakuu_marraskuu_joulukuu'.split('_'),
        monthsShort : 'tammi_helmi_maalis_huhti_touko_kesä_heinä_elo_syys_loka_marras_joulu'.split('_'),
        weekdays : 'sunnuntai_maanantai_tiistai_keskiviikko_torstai_perjantai_lauantai'.split('_'),
        weekdaysShort : 'su_ma_ti_ke_to_pe_la'.split('_'),
        weekdaysMin : 'su_ma_ti_ke_to_pe_la'.split('_'),
        longDateFormat : {
            LT : 'HH.mm',
            LTS : 'HH.mm.ss',
            L : 'DD.MM.YYYY',
            LL : 'Do MMMM[ta] YYYY',
            LLL : 'Do MMMM[ta] YYYY, [klo] HH.mm',
            LLLL : 'dddd, Do MMMM[ta] YYYY, [klo] HH.mm',
            l : 'D.M.YYYY',
            ll : 'Do MMM YYYY',
            lll : 'Do MMM YYYY, [klo] HH.mm',
            llll : 'ddd, Do MMM YYYY, [klo] HH.mm'
        },
        calendar : {
            sameDay : '[tänään] [klo] LT',
            nextDay : '[huomenna] [klo] LT',
            nextWeek : 'dddd [klo] LT',
            lastDay : '[eilen] [klo] LT',
            lastWeek : '[viime] dddd[na] [klo] LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : '%s päästä',
            past : '%s sitten',
            s : translate,
            ss : translate,
            m : translate,
            mm : translate,
            h : translate,
            hh : translate,
            d : translate,
            dd : translate,
            M : translate,
            MM : translate,
            y : translate,
            yy : translate
        },
        dayOfMonthOrdinalParse: /\d{1,2}\./,
        ordinal : '%d.',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return fi;

})));

// moment-timezone-localization for lang code: fi

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Abidjan","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Accra","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Addis Abeba","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Alger","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Asmara","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Bamako","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Bangui","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Banjul","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Bissau","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Blantyre","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Brazzaville","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Bujumbura","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"Kairo","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Casablanca","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"Ceuta","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"Conakry","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Dakar","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Dar es Salaam","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Djibouti","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Douala","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"El Aaiún","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Freetown","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Gaborone","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Harare","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Johannesburg","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Juba","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Kampala","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Khartum","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Kigali","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Kinshasa","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Lagos","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Libreville","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Lomé","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Luanda","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Lubumbashi","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Lusaka","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Malabo","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Maputo","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Maseru","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Mbabane","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Mogadishu","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Monrovia","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Nairobi","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"N’Djamena","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Niamey","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Nouakchott","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Ouagadougou","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Porto-Novo","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"São Tomé","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Tripoli","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Tunis","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Windhoek","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Adak","id":"America/Adak"},{"value":"America/Anchorage","name":"Anchorage","id":"America/Anchorage"},{"value":"America/Anguilla","name":"Anguilla","id":"America/Anguilla"},{"value":"America/Antigua","name":"Antigua","id":"America/Antigua"},{"value":"America/Araguaina","name":"Araguaína","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"La Rioja","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Rio Gallegos","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Salta","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"San Juan","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"San Luis","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Tucumán","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ushuaia","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Aruba","id":"America/Aruba"},{"value":"America/Asuncion","name":"Asunción","id":"America/Asuncion"},{"value":"America/Bahia","name":"Bahia","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Bahía de Banderas","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"Barbados","id":"America/Barbados"},{"value":"America/Belem","name":"Belem","id":"America/Belem"},{"value":"America/Belize","name":"Belize","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Blanc-Sablon","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Boa Vista","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Bogotá","id":"America/Bogota"},{"value":"America/Boise","name":"Boise","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Buenos Aires","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Cambridge Bay","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Campo Grande","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Cancún","id":"America/Cancun"},{"value":"America/Caracas","name":"Caracas","id":"America/Caracas"},{"value":"America/Catamarca","name":"Catamarca","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Cayenne","id":"America/Cayenne"},{"value":"America/Cayman","name":"Cayman","id":"America/Cayman"},{"value":"America/Chicago","name":"Chicago","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Chihuahua","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Atikokan","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Córdoba","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Costa Rica","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Creston","id":"America/Creston"},{"value":"America/Cuiaba","name":"Cuiabá","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Curaçao","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Danmarkshavn","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Dawson","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Dawson Creek","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Denver","id":"America/Denver"},{"value":"America/Detroit","name":"Detroit","id":"America/Detroit"},{"value":"America/Dominica","name":"Dominica","id":"America/Dominica"},{"value":"America/Edmonton","name":"Edmonton","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Eirunepé","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"El Salvador","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Fort Nelson","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Fortaleza","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Glace Bay","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"NuukGodthåb","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Goose Bay","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Grand Turk","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Grenada","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Guadeloupe","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Guatemala","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Guayaquil","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Guyana","id":"America/Guyana"},{"value":"America/Halifax","name":"Halifax","id":"America/Halifax"},{"value":"America/Havana","name":"Havanna","id":"America/Havana"},{"value":"America/Hermosillo","name":"Hermosillo","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Knox, Indiana","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Marengo, Indiana","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Petersburg, Indiana","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Tell City, Indiana","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Vevay, Indiana","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Vincennes, Indiana","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Winamac, Indiana","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Indianapolis","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Inuvik","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Iqaluit","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Jamaika","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Jujuy","id":"America/Jujuy"},{"value":"America/Juneau","name":"Juneau","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Monticello, Kentucky","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Kralendijk","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"La Paz","id":"America/La_Paz"},{"value":"America/Lima","name":"Lima","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Los Angeles","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Louisville","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Lower Prince’s Quarter","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Maceió","id":"America/Maceio"},{"value":"America/Managua","name":"Managua","id":"America/Managua"},{"value":"America/Manaus","name":"Manaus","id":"America/Manaus"},{"value":"America/Marigot","name":"Marigot","id":"America/Marigot"},{"value":"America/Martinique","name":"Martinique","id":"America/Martinique"},{"value":"America/Matamoros","name":"Matamoros","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Mazatlán","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Mendoza","id":"America/Mendoza"},{"value":"America/Menominee","name":"Menominee","id":"America/Menominee"},{"value":"America/Merida","name":"Mérida","id":"America/Merida"},{"value":"America/Metlakatla","name":"Metlakatla","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Ciudad de México","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Miquelon","id":"America/Miquelon"},{"value":"America/Moncton","name":"Moncton","id":"America/Moncton"},{"value":"America/Monterrey","name":"Monterrey","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Montevideo","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Montserrat","id":"America/Montserrat"},{"value":"America/Nassau","name":"Nassau","id":"America/Nassau"},{"value":"America/New_York","name":"New York","id":"America/New_York"},{"value":"America/Nipigon","name":"Nipigon","id":"America/Nipigon"},{"value":"America/Nome","name":"Nome","id":"America/Nome"},{"value":"America/Noronha","name":"Noronha","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Beulah, Pohjois-Dakota","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Center, Pohjois-Dakota","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"New Salem, Pohjois-Dakota","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Ojinaga","id":"America/Ojinaga"},{"value":"America/Panama","name":"Panama","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Pangnirtung","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Paramaribo","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Phoenix","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Port-au-Prince","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Port of Spain","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Porto Velho","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Puerto Rico","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Punta Arenas","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Rainy River","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Rankin Inlet","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Recife","id":"America/Recife"},{"value":"America/Regina","name":"Regina","id":"America/Regina"},{"value":"America/Resolute","name":"Resolute","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Rio Branco","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Santa Isabel","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Santarém","id":"America/Santarem"},{"value":"America/Santiago","name":"Santiago de Chile","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Santo Domingo","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"São Paulo","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"IttoqqortoormiitScoresbysund","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Sitka","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"Saint-Barthélemy","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"St. John’s","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"Saint Kitts","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"Saint Lucia","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"Saint Thomas","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"Saint Vincent","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"Swift Current","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Tegucigalpa","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"ThuleQaanaaq","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Thunder Bay","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Tijuana","id":"America/Tijuana"},{"value":"America/Toronto","name":"Toronto","id":"America/Toronto"},{"value":"America/Tortola","name":"Tortola","id":"America/Tortola"},{"value":"America/Vancouver","name":"Vancouver","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Whitehorse","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Winnipeg","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Yakutat","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Yellowknife","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"Casey","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"Davis","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"Dumont d’Urville","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"Macquariensaari","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"Mawson","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"McMurdo","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"Palmer","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"Rothera","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"Syowa","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"Troll","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"Vostok","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"Longyearbyen","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"Aden","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"Almaty","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"Amman","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"Anadyr","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"Aqtaw","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"Aqtöbe","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Ašgabat","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"Atıraw","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"Bagdad","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Bahrain","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"Baku","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"Bangkok","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"Barnaul","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"Beirut","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"Biškek","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"Brunei","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"Kalkutta","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"Tšita","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"Tšoibalsa","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"Colombo","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"Damaskos","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Dhaka","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"Dili","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"Dubai","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"Dušanbe","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"Famagusta","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"Gaza","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"Hebron","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"Hongkong","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"Hovd","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"Irkutsk","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"Jakarta","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"Jayapura","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"Jerusalem","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"Kabul","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"Kamtšatka","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"Karachi","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Kathmandu","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"Handyga","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"Krasnojarsk","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"Kuala Lumpur","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"Kuching","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"Kuwait","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"Macao","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"Magadan","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"Makassar","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"Manila","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"Masqat","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Nikosia","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"Novokuznetsk","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"Novosibirsk","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"Omsk","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"Uralsk","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"Phnom Penh","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"Pontianak","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"Pjongjang","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"Qatar","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"Qızılorda","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"Yangon","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"Riad","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"Hồ Chí Minhin kaupunki","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"Sahalin","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Samarkand","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Soul","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Shanghai","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Singapore","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"Srednekolymsk","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"Taipei","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"Taškent","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"Tbilisi","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"Teheran","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Thimphu","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Tokio","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"Tomsk","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"Ulan Bator","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"Ürümqi","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"Ust-Nera","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"Vientiane","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"Vladivostok","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"Jakutsk","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"Jekaterinburg","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"Jerevan","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"Azorit","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Bermuda","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"Kanariansaaret","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Kap Verde","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Färsaaret","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Madeira","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Reykjavík","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"Etelä-Georgia","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"Saint Helena","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Stanley","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"Adelaide","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"Brisbane","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"Broken Hill","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"Currie","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"Darwin","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"Eucla","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"Hobart","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"Lindeman","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"Lord Howe","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"Melbourne","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"Perth","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"Sydney","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"UTC-yleisaika","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Amsterdam","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"Andorra","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"Astrahan","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Ateena","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Belgrad","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Berliini","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"Bratislava","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"Bryssel","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Bukarest","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Budapest","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Büsingen","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"Chişinău","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"Kööpenhamina","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"Irlannin kesäaikaDublin","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Gibraltar","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Guernsey","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Helsinki","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"Mansaari","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"Istanbul","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Jersey","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Kaliningrad","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Kiova","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"Kirov","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"Lissabon","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Ljubljana","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"Britannian kesäaikaLontoo","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Luxemburg","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Madrid","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Malta","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"MaarianhaminaMariehamn","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"Minsk","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"Monaco","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Moskova","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Oslo","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"Pariisi","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"Podgorica","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"Praha","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Riika","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Rooma","id":"Europe/Rome"},{"value":"Europe/Samara","name":"Samara","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"San Marino","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"Sarajevo","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"Saratov","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"Simferopol","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"Skopje","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"Sofia","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Tukholma","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"Tallinna","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"Tirana","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Uljanovsk","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"Užgorod","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"Vaduz","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"Vatikaani","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Wien","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"Vilna","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"Volgograd","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Varsova","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Zagreb","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Zaporižžja","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Zürich","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Antananarivo","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"Chagos","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"Joulusaari","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"Kookossaaret","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"Komorit","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"Kerguelensaaret","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"Mahé","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Malediivit","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Mauritius","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Mayotte","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"Réunion","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Apia","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"Auckland","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"Bougainville","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"Chathamsaaret","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"Pääsiäissaari","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Efate","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"Enderbury","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"Fakaofo","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"Fidži","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"Funafuti","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"Galapagos","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"Gambiersaaret","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"Guadalcanal","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"Guam","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"Honolulu","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"Johnston","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"Kiritimati","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"Kosrae","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"Kwajalein","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"Majuro","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"Marquesassaaret","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"Midwaysaaret","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"Nauru","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"Niue","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"Norfolk","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"Nouméa","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"Pago Pago","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"Palau","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"Pitcairn","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"Pohnpei","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"Port Moresby","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"Rarotonga","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"Saipan","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"Tahiti","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Tarawa","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"Tongatapu","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"Chuuk","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"Wake","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"Wallis","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
