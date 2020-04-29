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
I18n._compiledMFs = {"too_few_topics_and_posts_notice_MF" : function(d){
var r = "";
r += "<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">Cominciamo la discussione!</a> ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "C'è <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> argomento";
return r;
},
"other" : function(d){
var r = "";
r += "Ci sono <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> argomenti";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " e ";
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
})() + "</strong> messaggio";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> messaggi";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".  I visitatori hanno bisogno di più per leggere e rispondere: – consigliamo almeno ";
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
})() + "</strong> argomento";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> argomenti";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " and ";
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
})() + "</strong> messaggio";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> messaggi";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Solo lo staff può vedere questo messaggio.";
return r;
}, "too_few_topics_notice_MF" : function(d){
var r = "";
r += "<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">Cominciamo la discussione!</a> ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "C'è <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> argomento";
return r;
},
"other" : function(d){
var r = "";
r += "Ci sono<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> argomenti";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".  I visitatori hanno bisogno di più per leggere e rispondere: – consigliamo almeno ";
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
})() + "</strong> argomento";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> argomenti";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Solo lo staff può vedere questo messaggio.";
return r;
}, "too_few_posts_notice_MF" : function(d){
var r = "";
r += "<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">Cominciamo la discussione!</a> ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "C'è <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> messaggio";
return r;
},
"other" : function(d){
var r = "";
r += "Ci sono <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> messaggi";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".  I visitatori hanno bisogno di più per leggere e rispondere: – consigliamo almeno ";
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
})() + "</strong> messaggio";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> messaggi";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Solo lo staff può vedere questo messaggio.";
return r;
}, "logs_error_rate_notice.reached_hour_MF" : function(){ return "Invalid Format: Error: No 'other' form found in pluralFormatPattern 0";}, "logs_error_rate_notice.reached_minute_MF" : function(){ return "Invalid Format: Error: No 'other' form found in pluralFormatPattern 0";}, "logs_error_rate_notice.exceeded_hour_MF" : function(){ return "Invalid Format: Error: No 'other' form found in pluralFormatPattern 0";}, "logs_error_rate_notice.exceeded_minute_MF" : function(){ return "Invalid Format: Error: No 'other' form found in pluralFormatPattern 0";}, "topic.read_more_MF" : function(d){
var r = "";
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
r += "C'è <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 argomento non letto</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "Ci sono <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " argomenti non letti</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "e ";
return r;
},
"false" : function(d){
var r = "";
r += "è ";
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
r += "/new'>1 nuovo</a> argomento";
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
r += "e ";
return r;
},
"false" : function(d){
var r = "";
r += "Ci sono ";
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
})() + " nuovi</a> argomenti";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " restanti, o ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "visualizza altri argomenti in ";
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
}, "topic.bumped_at_title_MF" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["FIRST_POST"];
r += ": ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["CREATED_AT"];
r += "\n";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["LAST_POST"];
r += ": ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["BUMPED_AT"];
return r;
}, "flagging.delete_confirm_MF" : function(d){
var r = "";
r += "Stai per cancellare ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> messaggio";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> messaggi";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " e ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> argomento";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> argomenti";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " di questo utente, rimuovere il suo account, bloccare l'iscrizione dall'indirizzo IP<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b>, e aggiungere il suo indirizzo email <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> ad un elenco nero permanente. Sei veramente sicuro che questo utente sia uno spammer?";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "Questo argomento ha ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 risposta";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " risposte";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "con un alto rapporto \"mi piace\" / messaggi";
return r;
},
"med" : function(d){
var r = "";
r += "con un altissimo rapporto \"mi piace\" / messaggi";
return r;
},
"high" : function(d){
var r = "";
r += "con un estremamente alto rapporto \"mi piace\" / messaggi";
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
r += "Stai per cancellare ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 messaggio";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " messaggi";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " e ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 argomento";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " argomenti";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["it"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Sei sicuro?";
return r;
}};
MessageFormat.locale.it = function ( n ) {
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

I18n.translations = {"it":{"js":{"number":{"format":{"separator":",","delimiter":" '"},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Byte"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"h:mm a","time_with_zone":"h:mm a (z)","time_short_day":"ddd, HH:mm","timeline_date":"MMM YYYY","long_no_year":"D MMM, HH:mm","long_no_year_no_time":"D MMM","full_no_year_no_time":"MMMM Do","long_with_year":"D MMM YYYY h:mm a","long_with_year_no_time":"D MMM YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"D MMM 'YY LT","long_date_without_year":"D MMM LT","long_date_with_year_without_time":"D MMM 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} fa","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c %{count}s","other":"\u003c %{count}s"},"x_seconds":{"one":"%{count}s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c %{count}m","other":"\u003c %{count}min"},"x_minutes":{"one":"%{count}m","other":"%{count}m"},"about_x_hours":{"one":"%{count}ora","other":"%{count} ore"},"x_days":{"one":"%{count}giorno","other":"%{count}giorni"},"x_months":{"one":"%{count} mese","other":"%{count}mesi"},"about_x_years":{"one":"%{count}anno","other":"%{count}anni"},"over_x_years":{"one":"\u003e %{count}anno","other":"\u003e %{count}anni"},"almost_x_years":{"one":"%{count}anno","other":"%{count}anni"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"%{count} min","other":"%{count} min"},"x_hours":{"one":"%{count} ora","other":"%{count} ore"},"x_days":{"one":"%{count} giorno","other":"%{count} giorni"},"date_year":"D MMM 'YY"},"medium_with_ago":{"x_minutes":{"one":"%{count} minuto fa","other":"%{count} minuti fa"},"x_hours":{"one":"%{count} ora fa","other":"%{count} ore fa"},"x_days":{"one":"%{count} giorno fa","other":"%{count}giorni fa"},"x_months":{"one":"%{count} mese fa","other":"%{count} mesi fa"},"x_years":{"one":"%{count} anno fa","other":"%{count} anni fa"}},"later":{"x_days":{"one":"%{count} giorno dopo","other":"%{count}giorni dopo"},"x_months":{"one":"%{count} mese dopo","other":"%{count} mesi dopo"},"x_years":{"one":"%{count} anno dopo","other":"%{count}anni dopo"}},"previous_month":"Mese Precedente","next_month":"Mese Successivo","placeholder":"data"},"share":{"topic_html":"Argomento: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"messaggio n°%{postNumber}","close":"chiudi","twitter":"Condividi questo collegamento su Twitter","facebook":"Condividi questo collegamento su Facebook","email":"Invia questo collegamento per email"},"action_codes":{"public_topic":"ha reso questo argomento pubblico %{when}","private_topic":"ha reso questo argomento un messaggio personale %{when}","split_topic":"ha separato questo argomento %{when}","invited_user":"ha invitato %{who} %{when}","invited_group":"ha invitato %{who} %{when}","user_left":"%{who}ha rimosso se stesso da questo messaggio %{when} ","removed_user":"rimosso %{who} %{when}","removed_group":"cancellato %{who} %{when}","autobumped":"riproposto automaticamente %{when}","autoclosed":{"enabled":"chiuso %{when}","disabled":"aperto %{when}"},"closed":{"enabled":"chiuso %{when}","disabled":"aperto %{when}"},"archived":{"enabled":"archiviato %{when}","disabled":"dearchiviato %{when}"},"pinned":{"enabled":"appuntato %{when}","disabled":"spuntato %{when}"},"pinned_globally":{"enabled":"appuntato globalmente %{when}","disabled":"spuntato %{when}"},"visible":{"enabled":"listato %{when}","disabled":"delistato %{when}"},"banner":{"enabled":"lo ha reso un annuncio il %{when}. Apparirà in cima ad ogni pagina finché non verrà chiuso dall'utente. ","disabled":"ha rimosso questo banner il %{when}. Non apparirà più in cima ad ogni pagina."},"forwarded":"inoltrato l'email qui sopra"},"topic_admin_menu":"azioni argomento","wizard_required":"Benvenuto al tuo nuovo Discourse! Inizia la \u003ca href='%{url}' data-auto-route='true'\u003eprocedura guidata di configurazione\u003c/a\u003e ✨","emails_are_disabled":"Tutte le email in uscita sono state disabilitate a livello globale da un amministratore. Non sarà inviato nessun tipo di notifica via email.","bootstrap_mode_enabled":"Per aiutarti ad avviare il tuo nuovo sito, adesso sei in modalità bootstrap. A tutti i nuovi utenti verrà assegnato il livello di esperienza 1 e le email riepilogative giornaliere saranno abilitate. Questa modalità sarà disattivata automaticamente quando avrai più di %{min_users} utenti iscritti.","bootstrap_mode_disabled":"La modalità bootstrap sarà disattivata entro 24 ore.","themes":{"default_description":"Default","broken_theme_alert":"Il tuo sito potrebbe non funzionare perché il tema / componente %{theme} contiene degli errori. Disabilitalo qui %{path}."},"s3":{"regions":{"ap_northeast_1":"Asia Pacifico (Tokyo)","ap_northeast_2":"Asia Pacifico (Seoul)","ap_south_1":"Asia Pacifico (Mumbai)","ap_southeast_1":"Asia Pacifico (Singapore)","ap_southeast_2":"Asia Pacifico (Sidney)","ca_central_1":"Canada (Centrale)","cn_north_1":"Cina (Beijing)","cn_northwest_1":"Cina","eu_central_1":"Europa (Francoforte)","eu_north_1":"EU (Stoccolma)","eu_west_1":"Europa (Irlanda)","eu_west_2":"EU (Londra)","eu_west_3":"UE (Parigi)","sa_east_1":"Sud America (San Paolo)","us_east_1":"Stati Uniti Est (Virginia del Nord)","us_east_2":"USA Est (Ohio)","us_gov_east_1":"AWS GovCloud (USA Est)","us_gov_west_1":"AWS GovCloud (US-West)","us_west_1":"Stati Uniti Ovest (California del Nord)","us_west_2":"Stati Uniti Ovest (Oregon)"}},"edit":"modifica titolo e categoria dell'argomento","expand":"Espandi","not_implemented":"Spiacenti! Questa funzione non è stata ancora implementata.","no_value":"No","yes_value":"Sì","submit":"Invia","generic_error":"Spiacenti, c'è stato un problema.","generic_error_with_reason":"Si è verificato un errore: %{error}","go_ahead":"Continua","sign_up":"Iscriviti","log_in":"Connetti","age":"Età","joined":"Iscritto","admin_title":"Amministratore","show_more":"mostra altro","show_help":"opzioni","links":"Collegamenti","links_lowercase":{"one":"collegamento","other":"collegamenti"},"faq":"FAQ","guidelines":"Linee Guida","privacy_policy":"Tutela Privacy","privacy":"Privacy","tos":"Termini di Servizio","rules":"Regole","conduct":"Codice di Condotta","mobile_view":"Visualizzazione Mobile","desktop_view":"Visualizzazione Desktop","you":"Tu","or":"oppure","now":"proprio ora","read_more":"continua","more":"Più","less":"Meno","never":"mai","every_30_minutes":"ogni 30 minuti","every_hour":"ogni ora","daily":"ogni giorno","weekly":"ogni settimana","every_month":"ogni mese","every_six_months":"ogni sei mesi","max_of_count":"massimo di {{count}}","alternation":"o","character_count":{"one":"{{count}} carattere","other":"{{count}} caratteri"},"related_messages":{"title":"Messaggi correlati","see_all":"Vedi \u003ca href=\"%{path}\"\u003etutti i messaggi\u003c/a\u003e di @ %{username} ..."},"suggested_topics":{"title":"Argomenti Suggeriti","pm_title":"Messaggi Suggeriti"},"about":{"simple_title":"Informazioni","title":"Informazioni su %{title}","stats":"Statistiche Sito","our_admins":"I Nostri Amministratori","our_moderators":"I Nostri Moderatori","moderators":"Moderatori","stat":{"all_time":"Sempre","last_7_days":"Ultimi 7","last_30_days":"Ultimi 30"},"like_count":"Mi piace","topic_count":"Argomenti","post_count":"Messaggi","user_count":"Utenti","active_user_count":"Utenti Attivi","contact":"Contattaci","contact_info":"Nel caso di un problema grave o urgente riguardante il sito, per favore contattaci all'indirizzo %{contact_info}."},"bookmarked":{"title":"Segnalibro","clear_bookmarks":"Cancella Segnalibri","help":{"bookmark":"Clicca per aggiungere un segnalibro al primo messaggio di questo argomento","unbookmark":"Clicca per rimuovere tutti i segnalibri a questo argomento","unbookmark_with_reminder":"Fare clic per rimuovere tutti i segnalibri e i promemoria in questo argomento. Hai un promemoria impostato %{reminder_at} per questo argomento."}},"bookmarks":{"created":"hai inserito questo messaggio nei segnalibri","not_bookmarked":"aggiungi ai segnalibri","created_with_reminder":"hai aggiunto un segnalibro a questo post con un promemoria %{date}","created_with_at_desktop_reminder":"hai aggiunto un segnalibro a questo post e ti verrà ricordato la prossima volta che sarai sul desktop","remove":"Rimuovi Segnalibro","confirm_clear":"Sei certo di voler rimuovere tutti i segnalibri da questo argomento?","save":"Salva","no_timezone":"Non hai ancora impostato un fuso orario. Non sarai in grado di impostare promemoria. Creane uno \u003ca href=\"%{basePath}/my/preferences/profile\"\u003enel tuo profilo\u003c/a\u003e .","invalid_custom_datetime":"La data e l'ora fornite non sono valide, riprova.","list_permission_denied":"Non sei autorizzato a visualizzare i segnalibri di questo utente.","reminders":{"at_desktop":"La prossima volta che sarò al mio desktop","later_today":"Più tardi oggi","next_business_day":"Il prossimo giorno lavorativo","tomorrow":"Domani","next_week":"La prossima settimana","later_this_week":"Più tardi questa settimana","start_of_next_business_week":"Il prossimo Lunedì","next_month":"Il prossimo mese","custom":"Data e ora personalizzate","last_custom":"Ultimo","none":"Nessun promemoria necessario","today_with_time":"oggi alle %{time}","tomorrow_with_time":"domani alle %{time}","at_time":"a %{date_time}","existing_reminder":"È stato impostato un promemoria per questo segnalibro che verrà inviato"}},"drafts":{"resume":"Riprendi","remove":"Rimuovi","new_topic":"Nuovo argomento in bozza","new_private_message":"Nuovo messaggio privato in bozza","topic_reply":"Risposta in bozza","abandon":{"confirm":"Hai già aperto una bozza in questo argomento. Sei sicuro di volerla abbandonare?","yes_value":"Sì, abbandona","no_value":"No, mantieni"}},"topic_count_latest":{"one":"Visualizza {{count}} argomenti nuovi o aggiornati","other":"Visualizza {{count}} argomenti nuovi o aggiornati."},"topic_count_unread":{"one":"V","other":"Visualizza {{count}} argomenti non letti "},"topic_count_new":{"one":"V","other":"Visualizza {{count}} nuovi argomenti"},"preview":"anteprima","cancel":"annulla","save":"Salva Modifiche","saving":"Salvataggio...","saved":"Salvato!","upload":"Carica","uploading":"In caricamento...","uploading_filename":"In caricamento: {{filename}}...","clipboard":"clipboard","uploaded":"Caricato!","pasting":"Incollando...","enable":"Attiva","disable":"Disattiva","continue":"Continua","undo":"Annulla","revert":"Ripristina","failed":"Fallito","switch_to_anon":"Avvia Modalità Anonima","switch_from_anon":"Esci Modalità Anonima","banner":{"close":"Nascondi questo annuncio.","edit":"Modifica questo annuncio \u003e\u003e"},"pwa":{"install_banner":"Vuoi \u003ca href\u003einstallare %{title} su questo dispositivo?\u003c/a\u003e"},"choose_topic":{"none_found":"Nessun argomento trovato.","title":{"search":"Cerca un argomento","placeholder":"digita qui il titolo dell\u0026#39;argomento, l\u0026#39;URL o l\u0026#39;id"}},"choose_message":{"none_found":"Nessun messaggio trovato.","title":{"search":"Cerca un messaggio","placeholder":"digita qui il titolo del messaggio, l\u0026#39;URL o l\u0026#39;id"}},"review":{"order_by":"Ordina per","in_reply_to":"in risposta a","explain":{"why":"spiega perché questo oggetto è stato aggiunto alla coda","title":"Punteggio revisionabile","formula":"Formula","subtotal":"Totale parziale","total":"Totale","min_score_visibility":"Punteggio minimo per visibilità","score_to_hide":"Punteggio per nascondere messaggio","take_action_bonus":{"name":"ha preso provvedimenti","title":"Quando un membro dello staff sceglie intervenire, la segnalazione riceve un bonus."},"user_accuracy_bonus":{"name":"precisione dell'utente","title":"Agli utenti le cui segnalazioni sono state storicamente accettate viene concesso un bonus."},"trust_level_bonus":{"name":"livello di esperienza","title":"Gli articoli revisionabili creati da utenti con un livello di esperienza più elevato hanno un punteggio più alto."},"type_bonus":{"name":"tipo di bonus","title":"Ad alcune tipologie revisionabili può essere assegnato un bonus dallo staff, per aumentare la loro priorità."}},"claim_help":{"optional":"Puoi rivendicare questo elemento per evitare che altri lo revisionino.","required":"Per poter revisionare gli elementi devi prima rivendicarli.","claimed_by_you":"Hai rivendicato questo elemento e puoi revisionarlo.","claimed_by_other":"Questo elemento può essere revisionato esclusivamente da \u003cb\u003e{{username}}\u003c/b\u003e."},"claim":{"title":"rivendica questo argomento"},"unclaim":{"help":"rimuovi questa rivendicazione"},"awaiting_approval":"In attesa di approvazione","delete":"Elimina","settings":{"saved":"Salvato","save_changes":"Salva le modifiche","title":"Impostazioni","priorities":{"title":"Priorità Revisionabili"}},"moderation_history":"Storico Moderazione","view_all":"Vedi tutti","grouped_by_topic":"Raggruppati per Argomento","none":"Non ci sono elementi da revisionare.","view_pending":"vedi in attesa","topic_has_pending":{"one":"Questo argomento ha \u003cb\u003e%{count}\u003c/b\u003e messaggio in attesa di approvazione","other":"Questo Argomento ha \u003cb\u003e{{count}}\u003c/b\u003e messaggi in attesa di approvazione"},"title":"Revisiona","topic":"Argomento:","filtered_topic":"Hai filtrato il contenuto revisionabile in un singolo Argomento","filtered_user":"Utente","show_all_topics":"mostra tutti gli argomenti","deleted_post":"(messaggio eliminato)","deleted_user":"(utente eliminato)","user":{"bio":"Biografia","website":"Sito web","username":"Nome utente","email":"Email","name":"Nome","fields":"Campi"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} segnalazione in totale)","other":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} segnalazioni in totale)"},"agreed":{"one":"{{count}}% a favore","other":"{{count}}% a favore"},"disagreed":{"one":"{{count}}% contrario","other":"{{count}}% contrari"},"ignored":{"one":"{{count}}% ignorato","other":"{{count}}% ignorati"}},"topics":{"topic":"Argomento","reviewable_count":"Conteggio","reported_by":"Segnalato da","deleted":"[Argomento eliminato]","original":"(argomento originale)","details":"dettagli","unique_users":{"one":"%{count} utente","other":"{{count}} utenti"}},"replies":{"one":"%{count} risposta","other":"{{count}} risposte"},"edit":"Modifica","save":"Salva","cancel":"Annulla","new_topic":"L'approvazione di questo elemento creerà un nuovo Argomento","filters":{"all_categories":"(tutte le categorie)","type":{"title":"Tipo","all":"(tutti i tipi)"},"minimum_score":"Punteggio minimo:","refresh":"Aggiorna","status":"Stato","category":"Categoria","orders":{"priority":"Priorità","priority_asc":"Priorità (inversa)","created_at":"Creato il","created_at_asc":"Data creazione (inversa)"},"priority":{"title":"Priorità Minima","low":"(qualsiasi)","medium":"Media","high":"Alta"}},"conversation":{"view_full":"vedi l'intera conversazione"},"scores":{"about":"Questo punteggio è calcolato sulla base del Livello di Esperienza del segnalante, dell'accuratezza delle precedenti segnalazioni e della priorità dell'elemento segnalato.","score":"Punteggio","date":"Data","type":"Tipo","status":"Stato","submitted_by":"Inviato da","reviewed_by":"Revisionato da"},"statuses":{"pending":{"title":"In attesa"},"approved":{"title":"Approvato"},"rejected":{"title":"Rifiutate"},"ignored":{"title":"Ignorato"},"deleted":{"title":"Eliminato"},"reviewed":{"title":"(tutti i revisionati)"},"all":{"title":"(tutto)"}},"types":{"reviewable_flagged_post":{"title":"Messaggio segnalato","flagged_by":"Segnalato da"},"reviewable_queued_topic":{"title":"Argomenti in coda"},"reviewable_queued_post":{"title":"Messaggio accodato"},"reviewable_user":{"title":"Utente"}},"approval":{"title":"Messaggio Da Approvare","description":"Abbiamo ricevuto il tuo messaggio ma prima che appaia è necessario che venga approvato da un moderatore. Per favore sii paziente.","pending_posts":{"one":"Hai\u003cstrong\u003e%{count}\u003c/strong\u003e messaggio in attesa.","other":"Hai\u003cstrong\u003e{{count}}\u003c/strong\u003e messaggi in attesa."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e ha pubblicato \u003ca href='{{topicUrl}}'\u003el'argomento\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eTu\u003c/a\u003e hai pubblicato \u003ca href='{{topicUrl}}'\u003el'argomento\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e ha risposto a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eTu\u003c/a\u003e hai risposto a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e ha risposto \u003ca href='{{topicUrl}}'\u003eall'argomento\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eTu\u003c/a\u003e hai risposto \u003ca href='{{topicUrl}}'\u003eall'argomento\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e ha menzionato \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e ha menzionato \u003ca href='{{user2Url}}'\u003ete\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eTu\u003c/a\u003e hai menzionato \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Pubblicato da \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Pubblicato da \u003ca href='{{userUrl}}'\u003ete\u003c/a\u003e","sent_by_user":"Inviato da \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Inviato da \u003ca href='{{userUrl}}'\u003ete\u003c/a\u003e"},"directory":{"filter_name":"filtra per nome utente","title":"Utenti","likes_given":"Dati","likes_received":"Ricevuti","topics_entered":"Visualizzati","topics_entered_long":"Argomenti Visualizzati","time_read":"Tempo di Lettura","topic_count":"Argomenti","topic_count_long":"Argomenti Creati","post_count":"Risposte","post_count_long":"Risposte Inviate","no_results":"Nessun risultato trovato.","days_visited":"Visite","days_visited_long":"Giorni Frequenza","posts_read":"Letti","posts_read_long":"Messaggi Letti","last_updated":"Ultimo aggiornamento:","total_rows":{"one":"%{count} utente","other":"%{count} utenti"}},"group_histories":{"actions":{"change_group_setting":"Cambia le impostazioni del gruppo","add_user_to_group":"Aggiunti utente","remove_user_from_group":"Rimuovi utente","make_user_group_owner":"Rendi proprietario","remove_user_as_group_owner":"Revoca proprietà"}},"groups":{"member_added":"Aggiunto","member_requested":"Richiesto alle","add_members":{"title":"Aggiungi Membri","description":"Gestisci le iscrizioni di questo gruppo","usernames":"Nomi Utente"},"requests":{"title":"Richieste","reason":"Motivo","accept":"Accetta","accepted":"accettata","deny":"Nega","denied":"negato","undone":"richiesta annullata","handle":"gestisci le richieste di iscrizione"},"manage":{"title":"Gestisci","name":"Nome","full_name":"Nome Completo","add_members":"Aggiungi Membri","delete_member_confirm":"Rimuovere '%{username}' dal gruppo '%{group}'?","profile":{"title":"Profilo"},"interaction":{"title":"Interazione","posting":"Pubblicazione","notification":"Notifica"},"membership":{"title":"Iscrizione","access":"Accesso"},"logs":{"title":"Log","when":"Quando","action":"Azione","acting_user":"Attante","target_user":"Utente destinatario","subject":"Oggetto","details":"Dettagli","from":"Da","to":"A"}},"public_admission":"Consenti agli utenti di unirsi al gruppo liberamente (richiede che il gruppo abbia visibilità pubblica)","public_exit":"Consenti agli utenti di lasciare il gruppo liberamente","empty":{"posts":"Non ci sono messaggi da membri di questo gruppo.","members":"Non ci sono membri in questo gruppo.","requests":"Non ci sono richieste di iscrizione a questo gruppo.","mentions":"Questo gruppo non è stato menzionato.","messages":"Non ci sono messaggi per questo gruppo.","topics":"Non ci sono argomenti da membri di questo gruppo.","logs":"Non ci sono log per questo gruppo."},"add":"Aggiungi","join":"Partecipa","leave":"Abbandona","request":"Richiesta","message":"Messaggio","confirm_leave":"Sei sicuro di voler abbandonare questo gruppo?","allow_membership_requests":"Consenti agli utenti di inviare richieste di ammissione ai proprietari dei gruppi (richiede un gruppo visibile pubblicamente)","membership_request_template":"Modello personalizzato da mostrare agli utenti quando inviano una richiesta di adesione","membership_request":{"submit":"Invia Richiesta","title":"Richiesta di adesione a @%{group_name}","reason":"Spiega ai proprietari del gruppo perché fai parte di questo gruppo"},"membership":"Iscrizione","name":"Nome","group_name":"Nome gruppo","user_count":"Utenti","bio":"Informazioni sul Gruppo","selector_placeholder":"inserisci nome utente","owner":"proprietario","index":{"title":"Gruppi","all":"Tutti i gruppi","empty":"Non ci sono gruppi visibili.","filter":"Filtra per tipo di gruppo","owner_groups":"Gruppi di cui sono proprietario","close_groups":"Gruppi Chiusi","automatic_groups":"Gruppi Automatici","automatic":"Automatico","closed":"Chiuso","public":"Pubblico","private":"Privato","public_groups":"Gruppi Pubblici","automatic_group":"Gruppo Automatico","close_group":"Gruppo Chiuso","my_groups":"I Miei Gruppi","group_type":"Tipo di gruppo","is_group_user":"Membro","is_group_owner":"Proprietario"},"title":{"one":"Group","other":"Gruppi"},"activity":"Attività","members":{"title":"Membri","filter_placeholder_admin":"nome utente o email","filter_placeholder":"nome utente","remove_member":"Rimuovi Membro","remove_member_description":"Rimuovi \u003cb\u003e%{username}\u003c/b\u003e da questo gruppo","make_owner":"Assegna Proprietà","make_owner_description":"Rendi \u003cb\u003e%{username}\u003c/b\u003e un proprietario di questo gruppo","remove_owner":"Rimuovi come Proprietario","remove_owner_description":"Rimuovi \u003cb\u003e%{username}\u003c/b\u003e come proprietario di questo gruppo ","owner":"Proprietario","forbidden":"Non puoi visualizzare i membri."},"topics":"Argomenti","posts":"Messaggi","mentions":"Menzioni","messages":"Messaggi","notification_level":"Livello di notifica predefinito per i messaggi di gruppo","alias_levels":{"mentionable":"Chi può @menzionare questo gruppo?","messageable":"Chi può inviare messaggi a questo gruppo?","nobody":"Nessuno","only_admins":"Solo gli amministratori","mods_and_admins":"Solo i moderatori e gli amministratori","members_mods_and_admins":"Solo i membri del gruppo, i moderatori e gli amministratori","owners_mods_and_admins":"Solo proprietari di gruppi, moderatori e amministratori","everyone":"Chiunque"},"notifications":{"watching":{"title":"In osservazione","description":"Verrai avvertito per ogni nuovo invio in qualsiasi messaggio, e verrà mostrato il conteggio delle nuove risposte."},"watching_first_post":{"title":"Osservando Primo Messaggio","description":"Riceverai una notifica per tutti i nuovi messaggi in questo gruppo, ma non per le risposte ai messaggi."},"tracking":{"title":"Seguendo","description":"Verrai avvertito se qualcuno menziona il tuo @nome o ti risponde, e verrà mostrato un conteggio delle nuove risposte."},"regular":{"title":"Esperto","description":"Verrai avvertito se qualcuno menziona il tuo @nome o ti risponde."},"muted":{"title":"Silenziato","description":"Non verrai avvertito di nulla riguardo ai messaggi in questo gruppo."}},"flair_url":"Immagine Avatar Flair","flair_url_placeholder":"(Facoltativo) URL Immagine o classe Font Awesome","flair_url_description":"Usa immagini quadrate non più piccole di 20px per 20px o icone FontAwesome (formati accettati: \"fa-icon\", \"far fa-icon\" o \"fab fa-icon\").","flair_bg_color":"Colore Sfondo Avatar Flair","flair_bg_color_placeholder":"(Facoltativo) Codice esadecimale del colore","flair_color":"Colore Avatar Flair","flair_color_placeholder":"(Facoltativo) Codice esadecimale del colore","flair_preview_icon":"Anteprima Icona","flair_preview_image":"Anteprima Immagine"},"user_action_groups":{"1":"Mi piace - Assegnati","2":"Mi piace - Ricevuti","3":"Segnalibri","4":"Argomenti","5":"Risposte","6":"Risposte","7":"Menzioni","9":"Citazioni","11":"Modifiche","12":"Elementi Inviati","13":"Posta in arrivo","14":"In Attesa","15":"Bozze"},"categories":{"all":"tutte le categorie","all_subcategories":"tutte","no_subcategory":"nessuno","category":"Categoria","category_list":"Visualizza l'elenco delle categorie","reorder":{"title":"Riordina Categorie","title_long":"Riorganizza l'elenco di categorie","save":"Salva Ordinamento","apply_all":"Applica","position":"Posizione"},"posts":"Messaggi","topics":"Argomenti","latest":"Più recenti","latest_by":"i più recenti di","toggle_ordering":"inverti l'ordinamento","subcategories":"Sottocategorie","topic_sentence":{"one":"%{count} argomento","other":"%{count} argomenti"},"topic_stat_sentence_week":{"one":"%{count} nuovo argomento nell'ultima settimana.","other":"%{count} nuovi argomenti nell'ultima settimana."},"topic_stat_sentence_month":{"one":"%{count} nuovo argomento nell'ultimo mese.","other":"%{count} nuovi argomenti nell'ultimo mese."},"n_more":"Categorie (altre %{count}) ..."},"ip_lookup":{"title":"Ricerca Indirizzo IP","hostname":"Hostname","location":"Località","location_not_found":"(sconosciuto)","organisation":"Organizzazione","phone":"Telefono","other_accounts":"Altri account con questo indirizzo IP:","delete_other_accounts":"Cancella %{count}","username":"nome utente","trust_level":"TL","read_time":"tempo lettura","topics_entered":"argomenti visualizzati","post_count":"n° messaggi","confirm_delete_other_accounts":"Sicuro di voler cancellare questi account?","powered_by":"tramite\u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"copiato"},"user_fields":{"none":"(scegli un'opzione)"},"user":{"said":"{{username}}:","profile":"Profilo","mute":"Ignora","edit":"Modifica opzioni","download_archive":{"button_text":"Scarica Tutto","confirm":"Sei sicuro di voler scaricare i tuoi messaggi?","success":"Esportazione iniziata, verrai avvertito con un messaggio al termine del processo.","rate_limit_error":"I messaggi possono essere scaricati una volta al giorno, riprova domani."},"new_private_message":"Nuovo Messaggio","private_message":"Messaggio","private_messages":"Messaggi","user_notifications":{"ignore_duration_title":"Ignora Timer","ignore_duration_username":"Nome utente","ignore_duration_when":"Durata:","ignore_duration_save":"Ignora","ignore_duration_note":"Si prega di notare che tutti gli utenti ignorati saranno rimossi allo scadere del relativo periodo di attesa.","ignore_duration_time_frame_required":"Per favore, seleziona un lasso di tempo","ignore_no_users":"Non ci sono utenti ignorati.","ignore_option":"Ignorato","ignore_option_title":"Non riceverai più notifiche relative a questo utente, ed i suoi Argomenti e le sue risposte saranno nascoste.","add_ignored_user":"Aggiungi...","mute_option":"Silenziati","mute_option_title":"Non riceverai più notifiche relative a questo utente.","normal_option":"Normale","normal_option_title":"Riceverai una notifica quando questo utente ti risponde, ti cita o ti menziona."},"activity_stream":"Attività","preferences":"Opzioni","feature_topic_on_profile":{"open_search":"Seleziona un nuovo argomento","title":"Seleziona un argomento","search_label":"Cerca argomento per titolo","save":"Salva","clear":{"title":"Pulisci","warning":"Sei sicuro di voler cancellare l\u0026#39;argomento in primo piano?"}},"use_current_timezone":"Usa Fuso Orario Corrente","profile_hidden":"Il profilo pubblico di questo utente è nascosto.","expand_profile":"Espandi","collapse_profile":"Raggruppa","bookmarks":"Segnalibri","bio":"Su di me","timezone":"Fuso orario","invited_by":"Invitato Da","trust_level":"Livello Esperienza","notifications":"Notifiche","statistics":"Statistiche","desktop_notifications":{"label":"Notifiche Desktop","not_supported":"Spiacenti, le notifiche non sono supportate su questo browser.","perm_default":"Attiva Notifiche","perm_denied_btn":"Permesso Negato","perm_denied_expl":"Hai negato il permesso per le notifiche. Autorizza le notifiche tramite le impostazioni del tuo browser.","disable":"Disabilita Notifiche","enable":"Abilita Notifiche","each_browser_note":"Nota: devi modificare questa impostazione per ogni browser che utilizzi.","consent_prompt":"Desideri ricevere notifiche in tempo reale quando qualcuno risponde a un tuo messaggio?"},"dismiss":"Ignora","dismiss_notifications":"Ignora tutti","dismiss_notifications_tooltip":"Imposta tutte le notifiche non lette come lette ","first_notification":"La tua prima notifica! Selezionala per iniziare.","dynamic_favicon":"Mostra il contatore sull'icona del browser","theme_default_on_all_devices":"Rendi questo il tema di default su tutti i miei dispositivi.","text_size_default_on_all_devices":"Rendi questa dimensione del testo di default su tutti i miei dispositivi","allow_private_messages":"Consenti agli altri utenti di inviarmi messaggi personali","external_links_in_new_tab":"Apri tutti i link esterni in nuove schede","enable_quoting":"Abilita \"rispondi quotando\" per il testo evidenziato","enable_defer":"Abilita il rinvio per contrassegnare gli argomenti come non letti","change":"cambia","featured_topic":"Argomento in primo piano","moderator":"{{user}} è un moderatore","admin":"{{user}} è un amministratore","moderator_tooltip":"Questo utente è un moderatore","admin_tooltip":"Questo utente è un amministratore","silenced_tooltip":"Questo utente è silenziato","suspended_notice":"Questo utente è sospeso fino al {{date}}.","suspended_permanently":"Questo utente è sospeso.","suspended_reason":"Motivo: ","github_profile":"Github","email_activity_summary":"Riassunto Attività","mailing_list_mode":{"label":"Modalità Mailing list","enabled":"Abilita la modalità mailing list","instructions":"Questa impostazione modifica il riassunto attività.\u003cbr /\u003e\nGli argomenti e le categorie silenziate non sono incluse in queste email.\n","individual":"Invia una email per ogni nuovo messaggio","individual_no_echo":"Invia una email per ogni nuovo messaggio, eccetto per i miei","many_per_day":"Inviamo una email per ogni nuovo messaggio (circa {{dailyEmailEstimate}} al giorno)","few_per_day":"Inviami una email per ogni nuovo messaggio (circa 2 al giorno)","warning":"Modalità Mailing List attiva. Le impostazioni per la notifica via email verranno ignorate."},"tag_settings":"Etichette","watched_tags":"Osservate","watched_tags_instructions":"Osserverai automaticamente tutti gli argomenti con questi tag. Verrai avvertito di tutti i nuovi messaggi e argomenti, e accanto all'argomento apparirà anche un conteggio dei nuovi messaggi.","tracked_tags":"Seguite","tracked_tags_instructions":"Seguirai automaticamente tutti gli argomenti con queste etichette. Accanto all'argomento apparirà il conteggio dei nuovi messaggi.","muted_tags":"Silenziati","muted_tags_instructions":"Non riceverai notifiche circa i nuovi argomenti con queste etichette, inoltre non appariranno in \"Ultimi\".","watched_categories":"Osservate","watched_categories_instructions":"Osserverai automaticamente tutti gli argomenti in queste categorie. Riceverai notifiche su tutti i nuovi messaggi e argomenti e, accanto all'argomento, apparirà il conteggio dei nuovi messaggi.","tracked_categories":"Seguite","tracked_categories_instructions":"Seguirai automaticamente tutti gli argomenti appartenenti a queste categorie. Accanto all'argomento comparirà il conteggio dei nuovi messaggi.","watched_first_post_categories":"Osservando Primo Messaggio","watched_first_post_categories_instructions":"Riceverai la notifica per il primo messaggio di ogni nuovo argomento in queste categorie.","watched_first_post_tags":"Osservando Primo Messaggio","watched_first_post_tags_instructions":"Riceverai la notifica per il primo messaggio di ogni nuovo argomento con queste etichette.","muted_categories":"Silenziate","muted_categories_instructions":"Non riceverai notifiche riguardanti i contenuti di queste categorie, e non appariranno nelle pagine delle Categorie o dei Recenti.","muted_categories_instructions_dont_hide":"Non riceverai alcuna notifica relativa a nuovi argomenti in queste categorie.","no_category_access":"Come moderatore hai accesso limitato alla categoria, il salvataggio è disabilitato.","delete_account":"Cancella il mio account","delete_account_confirm":"Sei sicuro di voler cancellare il tuo account in modo permanente? Questa azione non può essere annullata!","deleted_yourself":"Il tuo account è stato eliminato con successo.","delete_yourself_not_allowed":"Si prega di contattare un membro dello staff se si desidera che il proprio account venga eliminato","unread_message_count":"Messaggi","admin_delete":"Cancella","users":"Utenti","muted_users":"Silenziati","muted_users_instructions":"Occulta tutte le notifiche da questi utenti.","ignored_users":"Ignorato","ignored_users_instructions":"Nascondi tutti i messaggi e le notifiche da questi utenti.","tracked_topics_link":"Mostra","automatically_unpin_topics":"Spunta automaticamente gli argomenti quando arrivi in fondo.","apps":"Applicazioni","revoke_access":"Revoca Accesso","undo_revoke_access":"Annullare Revoca Accesso","api_approved":"Approvato:","api_last_used_at":"Ultimo utilizzo:","theme":"Tema","home":"Home Page Predefinita","staged":"Temporaneo","staff_counters":{"flags_given":"segnalazioni utili","flagged_posts":"messaggi segnalati","deleted_posts":"messaggi cancellati","suspensions":"sospensioni","warnings_received":"avvisi","rejected_posts":"messaggi rifiutati"},"messages":{"all":"Tutti","inbox":"In arrivo","sent":"Spediti","archive":"Archiviati","groups":"I Miei Gruppi","bulk_select":"Seleziona messaggi","move_to_inbox":"Sposta in arrivo","move_to_archive":"Archivia","failed_to_move":"Errore nello spostare i messaggi selezionati (forse la tua connessione non è attiva)","select_all":"Seleziona Tutti","tags":"Etichette"},"preferences_nav":{"account":"Account","profile":"Profilo","emails":"Email","notifications":"Notifiche","categories":"Categorie","users":"Utenti","tags":"Etichette","interface":"Interfaccia","apps":"App"},"change_password":{"success":"(email inviata)","in_progress":"(invio email in corso)","error":"(errore)","emoji":"blocca emoji","action":"Invia l'email per il ripristino della password","set_password":"Imposta Password","choose_new":"Scegli una nuova password","choose":"Scegli una password"},"second_factor_backup":{"title":"Codici di backup Due Fattori","regenerate":"Rigenera","disable":"Disabilita","enable":"Abilita","enable_long":"Abilita codici di backup","manage":"Gestisci i codici di backup. Hai \u003cstrong\u003e{{count}}\u003c/strong\u003e codici di backup rimanenti.","copied_to_clipboard":"Copiato nella Clipboard","copy_to_clipboard_error":"Errore durante la copia nella Clipboard","remaining_codes":"Ti sono rimasti \u003cstrong\u003e{{count}}\u003c/strong\u003e codici di backup.","use":"Usa un codice di backup","enable_prerequisites":"È necessario abilitare un secondo fattore primario prima di generare codici di backup.","codes":{"title":"Codici di backup generati","description":"Ciascuno di questi codici di backup può essere usato una sola volta. Conservali in un posto sicuro ma accessibile."}},"second_factor":{"title":"Autenticazione a Due Fattori","enable":"Gestione autenticazione a due fattori","forgot_password":"Ha dimenticato la password?","confirm_password_description":"Per favore conferma la tua password per continuare","name":"Nome","label":"Codice","rate_limit":"Attendi prima di provare un altro codice di autenticazione.","enable_description":"Scansiona il QR code con una delle app supportate (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e e inserisci il tuo codice di autenticazione.\n","disable_description":"Inserisci il codice di autenticazione dalla tua app","show_key_description":"Inserisci manualmente","short_description":"Proteggi il tuo account con un codice di sicurezza usa e getta.\n","extended_description":"L'autenticazione a due fattori aggiunge ulteriore sicurezza al tuo account attraverso la richiesta di un token usa e getta oltre alla tua password. I token possono essere generati su dispositivi \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e e \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e .\n","oauth_enabled_warning":"Tieni presente che gli accessi ai social network saranno disabilitati dopo aver attivato l'autenticazione a due fattori nel tuo account.","use":"Usa l'app Authenticator","enforced_notice":"E' obbligatorio abilitare l'autenticazione a due fattori per accedere a questo sito.","disable":"disabilita","disable_title":"Disabilita Secondo Fattore","disable_confirm":"Sei sicuro di voler disabilitare tutti i secondi fattori?","edit":"Modifica","edit_title":"Modifica secondo fattore","edit_description":"Nome del secondo fattore","enable_security_key_description":"Quando la chiave di sicurezza fisica è pronta, premi il pulsante Registra qui sotto.","totp":{"title":"Authenticator basati su Token","add":"Nuovo Authenticator","default_name":"Il mio Authenticator","name_and_code_required_error":"Devi fornire un nome e il codice dalla tua app di autenticazione."},"security_key":{"register":"Registrare","title":"Security Keys","add":"Registra Security Key","default_name":"Security Key principale","not_allowed_error":"Il processo di registrazione della Security Key è scaduto o è stato annullato.","already_added_error":"Hai già registrato questa Security Key. Non è necessario registrarla di nuovo.","edit":"Modifica Security Key","edit_description":"Nome Security Key","delete":"Elimina","name_required_error":"Devi fornire un nome per la Security Key"}},"change_about":{"title":"Modifica i dati personali","error":"Si è verificato un errore durante la modifica del valore."},"change_username":{"title":"Cambia Utente","confirm":"Sei sicuro di voler davvero cambiare il tuo nome utente?","taken":"Spiacenti, questo nome utente è già riservato.","invalid":"Nome utente non valido: usa solo lettere e cifre"},"change_email":{"title":"Cambia email","taken":"Spiacenti, questa email non è disponibile.","error":"C'è stato un errore nel cambio dell'email; potrebbe essere già usata da un altro utente.","success":"Abbiamo inviato una email a questo indirizzo. Segui le indicazioni di conferma.","success_staff":"Abbiamo inviato una email al tuo indirizzo corrente. Segui le istruzioni di conferma."},"change_avatar":{"title":"Cambia l'immagine del tuo profilo","gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e, basato su","gravatar_title":"Cambia il tuo avatar sul sito {{gravatarName}}","gravatar_failed":"Non è stato trovato alcun {{gravatarName}} abbinato a questa email. ","refresh_gravatar_title":"Ricarica il tuo {{gravatarName}}","letter_based":"Immagine del profilo assegnata dal sistema","uploaded_avatar":"Immagine personalizzata","uploaded_avatar_empty":"Aggiungi un'immagine personalizzata","upload_title":"Carica la tua foto","image_is_not_a_square":"Attenzione: abbiamo ritagliato l'immagine; la larghezza e l'altezza non erano uguali."},"change_profile_background":{"title":"Intestazione Profilo ","instructions":"Le intestazioni dei profili saranno centrate e avranno una larghezza predefinita di 1110 px."},"change_card_background":{"title":"Sfondo Scheda Utente","instructions":"Le immagini di sfondo saranno centrate e per difetto avranno un'ampiezza di 590px."},"change_featured_topic":{"title":"Argomento in primo piano","instructions":"Un collegamento a questo argomento sarà sulla tua scheda utente e profilo."},"email":{"title":"Email","primary":"Email principale","secondary":"Email secondaria","no_secondary":"Nessuna email secondaria","sso_override_instructions":"L'email può essere aggiornata dal provider SSO.","instructions":"Mai mostrato pubblicamente","ok":"Ti invieremo una email di conferma","invalid":"Inserisci un indirizzo email valido","authenticated":"{{provider}} ha autenticato la tua email","frequency_immediately":"Ti invieremo immediatamente una email se non hai letto ciò per cui ti stiamo scrivendo.","frequency":{"one":"TI invieremo un email solo se non ti avremo visto nell'ultimo minuto.","other":"Ti invieremo una email solo se non ti si vede da almeno {{count}} minuti."}},"associated_accounts":{"title":"Account associati","connect":"Connetti","revoke":"Revoca","cancel":"Annulla","not_connected":"(non connesso)","confirm_modal_title":"Collega un account %{provider} ","confirm_description":{"account_specific":"Il tuo account %{provider} '%{account_description}' verrà utilizzato per l'autenticazione.","generic":"Il tuo account %{provider} verrà utilizzato per l'autenticazione."}},"name":{"title":"Nome","instructions":"il tuo nome completo (opzionale)","instructions_required":"Il tuo nome completo","too_short":"Il nome è troppo breve","ok":"Il nome sembra adeguato"},"username":{"title":"Nome utente","instructions":"univoco, senza spazi, breve","short_instructions":"Gli utenti possono citarti scrivendo @{{username}}","available":"Il nome utente è disponibile","not_available":"Non disponibile. Prova {{suggestion}}?","not_available_no_suggestion":"Non disponibile","too_short":"Il nome utente è troppo corto","too_long":"Il nome utente è troppo lungo","checking":"Controllo la disponibilità del nome utente...","prefilled":"L'email corrisponde al nome utente registrato"},"locale":{"title":"Lingua dell'interfaccia","instructions":"Lingua dell'interfaccia utente. Cambierà quando aggiornerai la pagina.","default":"(default)","any":"qualunque"},"password_confirmation":{"title":"Ripeti la password"},"invite_code":{"title":"Codice Invito","instructions":"La registrazione dell'account richiede un codice di invito"},"auth_tokens":{"title":"Dispositivi utilizzati di recente","ip":"IP","details":"Dettagli","log_out_all":"Disconnetti tutti","active":"attivo ora","not_you":"Non sei tu?","show_all":"Mostra tutti ({{count}})","show_few":"Mostrane di meno","was_this_you":"Eri tu?","was_this_you_description":"Se non sei stato tu, ti raccomandiamo di cambiare la tua password e di disconnetterti da tutte le sessioni.","browser_and_device":"{{browser}} su {{device}}","secure_account":"Metti in sicurezza il mio account","latest_post":"Hai inviato il tuo ultimo messaggio..."},"last_posted":"Ultimo Messaggio","last_emailed":"Ultima email inviata","last_seen":"Ultima visita","created":"Membro da","log_out":"Disconnetti","location":"Località","website":"Sito Web","email_settings":"Email","hide_profile_and_presence":"Nascondi il mio profilo pubblico e la mia presenza","enable_physical_keyboard":"Attiva supporto alla tastiera fisica su iPad","text_size":{"title":"Dimensioni del testo","smaller":"Più piccolo","normal":"Normale","larger":"Più grande","largest":"Massima"},"title_count_mode":{"title":"Il titolo della pagina di background mostra il conteggio di:","notifications":"Nuove notifiche","contextual":"Nuovo contenuto nella pagina"},"like_notification_frequency":{"title":"Notifica alla ricezione di \"Mi piace\".","always":"Sempre","first_time_and_daily":"La prima volta che un messaggio riceve un \"Mi piace\" e giornalmente","first_time":"La prima volta che un messaggio riceve un \"Mi piace\"","never":"Mai"},"email_previous_replies":{"title":"Includi risposte precedenti al fondo delle email","unless_emailed":"a meno che non sia stato già inviato","always":"sempre","never":"mai"},"email_digests":{"title":"Quando non visito il sito, inviami un'email riepilogativa degli argomenti e delle risposte di successo","every_30_minutes":"ogni 30 minuti","every_hour":"ogni ora","daily":"ogni giorno","weekly":"ogni settimana","every_month":"ogni mese","every_six_months":"ogni sei mesi"},"email_level":{"title":"Inviami una email quando qualcuno mi cita, risponde ad un mio messaggio, menziona il mio @nomeutente, o mi invita in un argomento.","always":"sempre","only_when_away":"solo quando non collegato","never":"mai"},"email_messages_level":"Inviami una email quando qualcuno mi manda un messaggio","include_tl0_in_digests":"Includi contenuti dei nuovi utenti nelle email riepilogative","email_in_reply_to":"Nelle email includi un estratto delle risposte al messaggio","other_settings":"Altro","categories_settings":"Categorie","new_topic_duration":{"label":"Considera un argomento \"nuovo\" se","not_viewed":"non ancora visti","last_here":"è stato creato dopo la mia ultima visita","after_1_day":"creato nell'ultimo giorno","after_2_days":"creato negli ultimi 2 giorni","after_1_week":"creato nell'ultima settimana","after_2_weeks":"creato nelle ultime 2 settimane"},"auto_track_topics":"Segui automaticamente gli argomenti che leggo","auto_track_options":{"never":"mai","immediately":"Immediatamente","after_30_seconds":"dopo 30 secondi","after_1_minute":"dopo 1 minuto","after_2_minutes":"dopo 2 minuti","after_3_minutes":"dopo 3 minuti","after_4_minutes":"dopo 4 minuti","after_5_minutes":"dopo 5 minuti","after_10_minutes":"dopo 10 minuti"},"notification_level_when_replying":"Quando scrivo in un argomento, modifica il titolo dell'argomento a","invited":{"search":"digita per cercare inviti...","title":"Inviti","user":"Utente Invitato","sent":"Ultimo inviato","none":"Nessun invito da visualizzare.","truncated":{"one":"Mostro il primo invito.","other":"Mostro i primi {{count}} inviti."},"redeemed":"Inviti Accettati","redeemed_tab":"Riscattato","redeemed_tab_with_count":"Riscattato ({{count}})","redeemed_at":"Accettato","pending":"Inviti in sospeso","pending_tab":"In sospeso","pending_tab_with_count":"In sospeso ({{count}})","topics_entered":"Argomenti Visti","posts_read_count":"Messaggi Letti","expired":"L'invito è scaduto.","rescind":"Rimuovi","rescinded":"Invito revocato","rescind_all":"Rimuovi tutti gli inviti scaduti","rescinded_all":"Tutti gli inviti scaduti sono stati rimossi!","rescind_all_confirm":"Sei sicuro di voler rimuovere tutti gli inviti scaduti?","reinvite":"Rinvia Invito","reinvite_all":"Rispedisci tutti gli Inviti","reinvite_all_confirm":"Sei sicuro di voler inviare nuovamente tutti gli inviti?","reinvited":"Invito rinviato","reinvited_all":"Tutti gli inviti sono stati rispediti!","time_read":"Ora di Lettura","days_visited":"Giorni Frequenza","account_age_days":"Età dell'utente in giorni","create":"Invia un Invito","generate_link":"Copia il collegamento di invito","link_generated":"Collegamento di invito generato con successo!","valid_for":"Questo collegamento di invito è valido solamente per il seguente indirizzo email: %{email}","bulk_invite":{"none":"Non hai ancora invitato nessuno. Puoi inviare degli inviti individuali o più persone alla volta \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003ecaricando un file CSV\u003c/a\u003e.","text":"Invito di Massa da File","success":"Il file è stato caricato con successo, riceverai un messaggio di notifica quando il processo sarà completato.","error":"Spiacenti, il file deve essere in formato CSV.","confirmation_message":"Stai per inviare un invito via email a tutti gli indirizzi inclusi nel file caricato."}},"password":{"title":"Password","too_short":"La password è troppo breve.","common":"Questa password è troppo comune.","same_as_username":"La tua password è uguale al tuo nome utente.","same_as_email":"La password coincide con l'email.","ok":"La password è adeguata","instructions":"almeno %{count} caratteri"},"summary":{"title":"Riepilogo","stats":"Statistiche","time_read":"tempo di lettura","recent_time_read":"tempo di lettura recente","topic_count":{"one":"argomento creato","other":"argomenti creati"},"post_count":{"one":"messaggio creato","other":"messaggi creati"},"likes_given":{"one":"assegnati","other":"assegnati"},"likes_received":{"one":"ricevuti","other":"ricevuti"},"days_visited":{"one":"giorno di frequenza","other":"giorni di frequenza"},"topics_entered":{"one":"argomenti visualizzati","other":"argomenti visualizzati"},"posts_read":{"one":"messaggio letto","other":"messaggi letti"},"bookmark_count":{"one":"segnalibro","other":"segnalibri"},"top_replies":"Migliori Risposte","no_replies":"Ancora nessuna risposta.","more_replies":"Altre Risposte","top_topics":"Migliori Argomenti","no_topics":"Ancora nessun argomento.","more_topics":"Altri Argomenti","top_badges":"Migliori Distintivi","no_badges":"Ancora nessun distintivo.","more_badges":"Altri Distintivi","top_links":"Migliori Collegamenti","no_links":"Ancora nessun collegamento.","most_liked_by":"Ricevuto più \"Mi Piace\" da","most_liked_users":"Con più \"Mi Piace\"","most_replied_to_users":"Più Risposte A","no_likes":"Ancora nessun \"Mi piace\".","top_categories":"Categorie principali","topics":"Argomenti","replies":"Risposte"},"ip_address":{"title":"Ultimo indirizzo IP"},"registration_ip_address":{"title":"Indirizzo IP di Registrazione"},"avatar":{"title":"Immagine Profilo","header_title":"profilo, messaggi, segnalibri e preferenze"},"title":{"title":"Titolo","none":"(nessuno)"},"primary_group":{"title":"Gruppo Primario","none":"(nessuno)"},"filters":{"all":"Tutti"},"stream":{"posted_by":"Pubblicato da","sent_by":"Inviato da","private_message":"messaggio","the_topic":"l'argomento"}},"loading":" Caricamento...","errors":{"prev_page":"durante il caricamento","reasons":{"network":"Errore di Rete","server":"Errore del Server","forbidden":"Accesso Negato","unknown":"Errore","not_found":"Pagina Non Trovata"},"desc":{"network":"Per favore controlla la connessione.","network_fixed":"Sembra essere tornato.","server":"Codice di errore: {{status}}","forbidden":"Non hai i permessi per visualizzarlo.","not_found":"Oops, l'applicazione ha cercato di caricare una URL inesistente.","unknown":"Qualcosa è andato storto."},"buttons":{"back":"Torna Indietro","again":"Riprova","fixed":"Carica Pagina"}},"modal":{"close":"chiudi","dismiss_error":"Ignora errore"},"close":"Chiudi","assets_changed_confirm":"Questo sito è stato aggiornato. Aggiornare ora alla nuova versione?","logout":"Sei stato disconnesso.","refresh":"Ricarica","read_only_mode":{"enabled":"Questo sito è in modalità di sola lettura. Puoi continuare a navigare nel sito, ma le risposte, i \"Mi piace\" e altre azioni sono per il momento disabilitate.","login_disabled":"La connessione è disabilitata quando il sito è in modalità di sola lettura.","logout_disabled":"La disconnessione è disabilitata quando il sito è in modalità di sola lettura."},"logs_error_rate_notice":{},"learn_more":"per saperne di più...","all_time":"totale","all_time_desc":"totale argomenti creati","year":"all'anno","year_desc":"argomenti creati negli ultimi 365 giorni","month":"al mese","month_desc":"argomenti creati negli ultimi 30 giorni","week":"a settimana","week_desc":"argomenti creati negli ultimi 7 giorni","day":"al giorno","first_post":"Primo messaggio","mute":"Ignora","unmute":"Attiva","last_post":"Ultimo messaggio","time_read":"Letti","time_read_recently":"%{time_read} recentemente","time_read_tooltip":"%{time_read} tempo totale di lettura","time_read_recently_tooltip":"%{time_read} tempo totale di lettura (%{recent_time_read} negli ultimi 60 giorni)","last_reply_lowercase":"ultima risposta","replies_lowercase":{"one":"risposta","other":"risposte"},"signup_cta":{"sign_up":"Iscriviti","hide_session":"Ricordamelo domani","hide_forever":"no grazie","hidden_for_session":"Ok, te lo chiederò domani. Puoi anche usare 'Connetti' per creare un account.","intro":"Ciao! Sembra che la discussione ti interessi, ma non hai ancora registrato un account.","value_prop":"Quando crei un account, potremo ricordare esattamente cosa hai letto, in modo che tu possa riprendere esattamente da dove hai lasciato. Riceverai inoltre notifiche, qui o via email, quando qualcuno ti risponde. Potrai anche mettere \"Mi piace\" per mostrare il tuo apprezzamento :heartpulse:"},"summary":{"enabled_description":"Stai visualizzando un riepilogo dell'argomento: è la comunità a determinare quali sono i messaggi più interessanti.","description":"Ci sono \u003cb\u003e{{replyCount}}\u003c/b\u003e risposte.","description_time":"Ci sono \u003cb\u003e{{replyCount}}\u003c/b\u003e risposte con un tempo stimato di lettura di \u003cb\u003e{{readingTime}} minuti\u003c/b\u003e.","enable":"Riassumi Questo Argomento","disable":"Mostra Tutti i Messaggi"},"deleted_filter":{"enabled_description":"Questo argomento contiene messaggi eliminati, che sono quindi nascosti.","disabled_description":"I messaggi eliminati di questo argomento sono ora visibili.","enable":"Nascondi Messaggi Eliminati","disable":"Mostra Messaggi Eliminati"},"private_message_info":{"title":"Messaggio","invite":"Invita altri...","edit":"Aggiungi o rimuovi...","leave_message":"Vuoi veramente abbandonare questo messaggio?","remove_allowed_user":"Davvero vuoi rimuovere {{name}} da questo messaggio?","remove_allowed_group":"Vuoi veramente rimuovere {{name}} da questo messaggio?"},"email":"Email","username":"Nome utente","last_seen":"Ultima visita","created":"Creato","created_lowercase":"creato","trust_level":"Livello Esperienza","search_hint":"nome utente, email o indirizzo IP","create_account":{"disclaimer":"Registrandoti accetti il \u003ca href='{{privacy_link}}' target='blank'\u003eregolamento sulla Privacy\u003c/a\u003e e \u003ca href='{{tos_link}}' target='blank'\u003ei termini di servizio\u003c/a\u003e.","title":"Crea Nuovo Account","failed":"Qualcosa non ha funzionato. Forse questa email è già registrata, prova a usare il link di recupero password"},"forgot_password":{"title":"Reimposta Password","action":"Ho dimenticato la password","invite":"Inserisci il nome utente o l'indirizzo email. Ti manderemo un'email per l'azzeramento della password.","reset":"Reimposta Password","complete_username":"Se un account corrisponde al nome utente \u003cb\u003e%{username}\u003c/b\u003e, a breve dovresti ricevere un'email con le istruzioni per ripristinare la tua password.","complete_email":"Se un account corrisponde a \u003cb\u003e%{email}\u003c/b\u003e, a breve dovresti ricevere un'email contenente le istruzioni per ripristinare la password.","complete_username_found":"C'è un account che corrisponde al nome utente \u003cb\u003e%{username}\u003c/b\u003e. A breve dovresti ricevere una email con le istruzioni per reimpostare la tua password. ","complete_email_found":"C'è un account che corrisponde a \u003cb\u003e%{email}\u003c/b\u003e. A breve dovresti ricevere una email con le istruzioni per reimpostare la tua password. ","complete_username_not_found":"Nessun account corrisponde al nome utente \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Nessun account corrisponde a \u003cb\u003e%{email}\u003c/b\u003e","help":"Le email non arrivano? Per prima cosa assicurati di controllare la cartella spam.\u003cp\u003eNon sei sicuro di quale indirizzo email hai usato? Inserisci un indirizzo email e ti faremo sapere se esiste.\u003c/p\u003e\u003cp\u003eSe non hai più accesso all'indirizzo email del tuo account, per favore contatta \u003ca href='%{basePath}/about'\u003eil nostro staff.\u003c/a\u003e\u003c/p\u003e","button_ok":"OK","button_help":"Aiuto"},"email_login":{"link_label":"Inviami un link di accesso","button_label":"con email","emoji":"emoji lock","complete_username":"Se un account corrisponde al nome utente \u003cb\u003e%{username}\u003c/b\u003e , a breve dovresti ricevere un'email con un collegamento per l'accesso.","complete_email":"Se un account corrisponde a \u003cb\u003e%{email}\u003c/b\u003e, a breve dovresti ricevere un'email con un collegamento per l'accesso.","complete_username_found":"Abbiamo trovato un account che corrisponde al nome utente \u003cb\u003e%{username}\u003c/b\u003e, a breve dovresti ricevere un'email con un collegamento per l'accesso.","complete_email_found":"Abbiamo trovato un account che corrisponde a \u003cb\u003e%{email}\u003c/b\u003e, a breve dovresti ricevere una email con un collegamento per l'accesso.","complete_username_not_found":"Nessun account con nome utente \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Nessun account con email \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"Procedi su %{site_name}","logging_in_as":"Accesso come %{email}","confirm_button":"Completa l'accesso"},"login":{"title":"Connetti","username":"Utente","password":"Password","second_factor_title":"Autenticazione a due fattori","second_factor_description":"Per favore, inserisci il codice di autenticazione della tua app:","second_factor_backup":"Accedi utilizzando un codice di backup","second_factor_backup_title":"Backup Due Fattori","second_factor_backup_description":"Per favore, inserisci uno dei tuoi codici di backup:","second_factor":"Accedi utilizzando l'app Authenticator","security_key_description":"Quando hai preparato la chiave di sicurezza fisica, premi il pulsante Autentica con Security Key qui sotto.","security_key_alternative":"Prova in un altro modo","security_key_authenticate":"Autentica con Security Key","security_key_not_allowed_error":"Il processo di autenticazione con Security Key è scaduto o è stato annullato.","security_key_no_matching_credential_error":"Non è stato possibile trovare credenziali corrispondenti nella chiave di sicurezza fornita.","security_key_support_missing_error":"Il tuo dispositivo o browser attuale non supporta l\u0026#39;uso di chiavi di sicurezza. Si prega di utilizzare un altro metodo.","email_placeholder":"email o nome utente","caps_lock_warning":"Il Blocco Maiuscole è attivo","error":"Errore sconosciuto","cookies_error":"Sembra che il tuo browser abbia i cookie disabilitati. Potresti non riuscire a connetterti senza abilitarli.","rate_limit":"Attendi prima di provare nuovamente a connetterti.","blank_username":"Per favore, inserisci la tua email o il tuo nome utente.","blank_username_or_password":"Per favore inserisci la tua email o il tuo nome utente, e la password.","reset_password":"Azzera Password","logging_in":"Connessione in corso...","or":"Oppure","authenticating":"Autenticazione...","awaiting_activation":"Il tuo account è in attesa di attivazione, utilizza il collegamento per la password dimenticata per ricevere un'altra email di attivazione.","awaiting_approval":"Il tuo account non è stato ancora approvato da un membro dello staff. Ti invieremo un'email non appena verrà approvato.","requires_invite":"Spiacenti, l'accesso a questo forum e solo ad invito.","not_activated":"Non puoi ancora connetterti. Abbiamo inviato un'email di attivazione a \u003cb\u003e{{sentTo}}\u003c/b\u003e. Per favore segui le istruzioni contenute nell'email per attivare l'account.","not_allowed_from_ip_address":"Non puoi connetterti con questo indirizzo IP.","admin_not_allowed_from_ip_address":"Non puoi connetterti come amministratore da quell'indirizzo IP.","resend_activation_email":"Clicca qui per inviare nuovamente l'email di attivazione.","omniauth_disallow_totp":"L'autenticazione a due fattori è abilitata per Il tuo account. Per favore, connettiti con la tua password.","resend_title":"Invia Nuovamente Email Attivazione","change_email":"Cambia Indirizzo Email","provide_new_email":"Fornisci un nuovo indirizzo e invieremo nuovamente la tua email di conferma.","submit_new_email":"Aggiorna Indirizzo Email","sent_activation_email_again":"Ti abbiamo mandato un'altra email di attivazione su \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Potrebbero essere necessari alcuni minuti di attesa; assicurati di controllare anche la cartella  spam.","sent_activation_email_again_generic":"Abbiamo inviato un'altra email di attivazione. Potrebbero passare alcuni minuti prima che arrivi; assicurati di controllare la tua cartella spam.","to_continue":"Per favore Connettiti","preferences":"Devi essere connesso per cambiare le tue impostazioni.","forgot":"Non ricordo i dettagli del mio account","not_approved":"Il tuo account non è ancora stato approvato. Verrai avvertito via email quando potrai collegarti.","google_oauth2":{"name":"Google","title":"con Google"},"twitter":{"name":"Twitter","title":"con Twitter"},"instagram":{"name":"Instagram","title":"con Instagram"},"facebook":{"name":"Facebook","title":"con Facebook"},"github":{"name":"GitHub","title":"con GitHub"},"discord":{"name":"Discord","title":"con Discord"},"second_factor_toggle":{"totp":"Utilizzare un'app di autenticazione","backup_code":"Utilizza un codice di backup"}},"invites":{"accept_title":"Invito","emoji":"emoji envelope","welcome_to":"Benvenuto su %{site_name}!","invited_by":"Sei stato invitato da:","social_login_available":"Sarai anche in grado di accedere con qualsiasi login social usando questa email.","your_email":"L'indirizzo email del tuo account è \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"Accetta Invito","success":"Il tuo account è stato creato e ora sei connesso.","name_label":"Nome","password_label":"Imposta Password","optional_description":"(opzionale)"},"password_reset":{"continue":"Procedi su %{site_name}"},"emoji_set":{"apple_international":"Apple/Internazionale","google":"Google","twitter":"Twitter","emoji_one":"JoyPixels (precedentemente EmojiOne)","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Solo Categorie","categories_with_featured_topics":"Categorie con argomenti in evidenza","categories_and_latest_topics":"Categorie e Argomenti Recenti","categories_and_top_topics":"Categorie e Argomenti Popolari","categories_boxes":"Riquadri con sottocategorie","categories_boxes_with_topics":"Riquadri con Argomenti in evidenza"},"shortcut_modifier_key":{"shift":"Maiusc","ctrl":"Ctrl","alt":"Alt","enter":"Invio"},"conditional_loading_section":{"loading":"In caricamento..."},"category_row":{"topic_count":"{{count}} argomenti in questa categoria"},"select_kit":{"default_header_text":"Selezione...","no_content":"Nessun risultato trovato","filter_placeholder":"Ricerca...","filter_placeholder_with_any":"Cerca o crea...","create":"Crea: '{{content}}'","max_content_reached":{"one":"Puoi selezionare solo {{count}} elemento.","other":"Puoi selezionare solo {{count}} elementi."},"min_content_not_reached":{"one":"Seleziona almeno {{count}} elemento.","other":"Seleziona almeno {{count}} elementi."},"invalid_selection_length":"La selezione deve contenere almeno {{count}} caratteri."},"date_time_picker":{"from":"Da","to":"A","errors":{"to_before_from":"La data di fine deve essere successiva alla data di inizio."}},"emoji_picker":{"filter_placeholder":"Ricerca per emoji","smileys_\u0026_emotion":"Smileys ed Emotion","people_\u0026_body":"Persone e parti del corpo","animals_\u0026_nature":"Animali e Natura","food_\u0026_drink":"Cibo e Bevande","travel_\u0026_places":"Viaggi e Località","activities":"Attività","objects":"Oggetti","symbols":"Simboli","flags":"Bandiere","recent":"Usate recentemente","default_tone":"Nessun tono della pelle","light_tone":"Tono della pelle chiaro","medium_light_tone":"Tono della pelle medio chiaro","medium_tone":"Tono della pelle medio","medium_dark_tone":"Tono della pelle medio scuro","dark_tone":"Tono della pelle scuro","default":"Emoji personalizzate"},"shared_drafts":{"title":"Bozze condivise","notice":"L'argomento è visibile solo a chi può vedere la categoria \u003cb\u003e{{category}}\u003c/b\u003e.","destination_category":"Categoria di destinazione","publish":"Pubblica Bozza Condivisa","confirm_publish":"Confermi la pubblicazione di questa bozza?","publishing":"Argomento in pubblicazione..."},"composer":{"emoji":"Emoji :)","more_emoji":"altro...","options":"Opzioni","whisper":"sussurra","unlist":"invisibile","blockquote_text":"Citazione","add_warning":"Questo è un avvertimento ufficiale.","toggle_whisper":"Attiva/Disattiva Sussurri","toggle_unlisted":"Rendi Invisibile","posting_not_on_topic":"A quale argomento vuoi rispondere?","saved_local_draft_tip":"salvato in locale","similar_topics":"Il tuo argomento è simile a...","drafts_offline":"bozze offline","edit_conflict":"modifica conflitto","group_mentioned_limit":"\u003cb\u003eAttenzione!\u003c/b\u003e Hai menzionato \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e, tuttavia questo gruppo ha più membri del limite per le menzioni di {{max}} utenti  configurato dagli amministratori . Nessuna notifica verrà inviata. ","group_mentioned":{"one":"Menzionando {{group}}, verrà notificata \u003ca href='{{group_link}}'\u003e%{count} persona\u003c/a\u003e – sei sicuro?","other":"Menzionando {{group}}, verranno notificate \u003ca href='{{group_link}}'\u003e{{count}} persone\u003c/a\u003e – sei sicuro?"},"cannot_see_mention":{"category":"Hai menzionato {{username}} ma non verranno notificati perché non hanno accesso a questa categoria. Dovrai aggiungerli ad un gruppo che ha accesso a questa categoria.","private":"Hai menzionato {{username}} ma non verranno notificati perché non hanno accesso a questo messaggio personale. Dovrai invitarli a questo MP."},"duplicate_link":"Sembra che il tuo collegamento a \u003cb\u003e{{domain}}\u003c/b\u003e sia già stato pubblicato in questo argomento da \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003euna risposta di {{ago}}\u003c/a\u003e - sei sicuro di volerlo pubblicare ancora?","reference_topic_title":"RE: {{title}}","error":{"title_missing":"Il titolo è richiesto","title_too_short":"Il titolo deve essere lungo almeno {{min}} caratteri","title_too_long":"Il titolo non può essere più lungo di {{max}} caratteri","post_missing":"Il messaggio non può essere vuoto","post_length":"Il messaggio deve essere lungo almeno {{min}} caratteri","try_like":"Hai provato ad usare il pulsante {{heart}} ?","category_missing":"Devi scegliere una categoria","tags_missing":"Devi scegliere almeno {{count}} etichette","topic_template_not_modified":"Aggiungi dettagli e specificità al tuo argomento modificando il modello di argomento."},"save_edit":"Salva Modifiche","overwrite_edit":"Sovrascrivi modifica","reply_original":"Rispondi all'Argomento Originale","reply_here":"Rispondi Qui","reply":"Rispondi","cancel":"Annulla","create_topic":"Crea Argomento","create_pm":"Messaggio","create_whisper":"Sussurro","create_shared_draft":"Crea Bozza condivisa","edit_shared_draft":"Modifica Bozza condivisa","title":"O premi Ctrl+Enter","users_placeholder":"Aggiunti un utente","title_placeholder":"In breve, di cosa tratta questo argomento?","title_or_link_placeholder":"Digita il titolo, o incolla qui il collegamento ","edit_reason_placeholder":"perché stai scrivendo?","topic_featured_link_placeholder":"Inserisci il collegamento mostrato con il titolo.","remove_featured_link":"Rimuovi il collegamento dall'argomento.","reply_placeholder":"Scrivi qui. Per formattare il testo usa Markdown, BBCode o HTML. Trascina o incolla le immagini.","reply_placeholder_no_images":"Scrivi qui. Usa Markdown, BBcode o HTML per formattare.","reply_placeholder_choose_category":"Seleziona una categoria prima di scrivere qui.","view_new_post":"Visualizza il tuo nuovo messaggio.","saving":"Salvataggio","saved":"Salvato!","saved_draft":"Bozza del messaggio in corso. Tocca per riprendere.","uploading":"In caricamento...","show_preview":"visualizza anteprima \u0026raquo;","hide_preview":"\u0026laquo; nascondi anteprima","quote_post_title":"Cita l'intero messaggio","bold_label":"G","bold_title":"Grassetto","bold_text":"testo in grassetto","italic_label":"I","italic_title":"Italic","italic_text":"testo italic","link_title":"Collegamento","link_description":"inserisci qui la descrizione del collegamento","link_dialog_title":"Inserisci il collegamento","link_optional_text":"titolo opzionale","link_url_placeholder":"Incolla un URL o digita per cercare argomenti","quote_title":"Citazione","quote_text":"Citazione","code_title":"Testo preformattato","code_text":"rientra il testo preformattato di 4 spazi","paste_code_text":"digita o incolla il codice qui","upload_title":"Carica","upload_description":"inserisci qui la descrizione del caricamento","olist_title":"Elenco Numerato","ulist_title":"Elenco Puntato","list_item":"Elemento lista","toggle_direction":"Commuta Direzione","help":"Aiuto Inserimento Markdown","collapse":"minimizza il pannello del composer","open":"Apri il pannello del composer","abandon":"chiudi il composer e scarta la bozza","enter_fullscreen":"Espandi il composer a tutto schermo","exit_fullscreen":"Lascia il composer a tutto schermo","modal_ok":"OK","modal_cancel":"Annulla","cant_send_pm":"Spiacenti, non puoi inviare un messaggio a %{username}.","yourself_confirm":{"title":"Hai dimenticato di aggiungere i destinatari?","body":"Per ora il messaggio sarà inviato solo a te stesso!"},"admin_options_title":"Impostazioni dello staff opzionali per l'argomento","composer_actions":{"reply":"Rispondi","draft":"Bozza","edit":"Modifica","reply_to_post":{"label":"Rispondi al messaggio %{postNumber} di %{postUsername}","desc":"Rispondi a uno specifico messaggio"},"reply_as_new_topic":{"label":"Rispondi con un argomento correlato","desc":"Crea un nuovo argomento collegato a questo argomento","confirm":"È stata salvata una nuova bozza di argomento, che verrà sovrascritta se si crea un argomento collegato."},"reply_as_private_message":{"label":"Nuovo messaggio","desc":"Crea un nuovo messaggio personale"},"reply_to_topic":{"label":"Rispondi all'argomento","desc":"Rispondi all'argomento, non a uno specifico messaggio"},"toggle_whisper":{"label":"Commuta Sussurri","desc":"I Sussurri sono visibili solo ai membri dello staff"},"create_topic":{"label":"Nuovo Argomento"},"shared_draft":{"label":"Bozza Condivisa","desc":"Prepara la bozza di un argomento che sarà visibile solo allo Staff"},"toggle_topic_bump":{"label":"Commuta riproposizione argomenti","desc":"Rispondi senza cambiare la data dell'ultima risposta"}},"details_title":"Riepilogo","details_text":"Questo testo verrà nascosto"},"notifications":{"tooltip":{"regular":{"one":"%{count} notifica non visualizzata","other":"{{count}} notifiche non visualizzate"},"message":{"one":"%{count} messaggio non letto","other":"{{count}} messaggi non letti"},"high_priority":{"one":"%{count} notifica ad alta priorità non letta","other":"%{count} notifiche ad alta priorità non lette"}},"title":"notifiche di menzioni @nome, risposte ai tuoi messaggi e argomenti ecc.","none":"Impossibile caricare le notifiche al momento.","empty":"Nessuna notifica trovata.","post_approved":"Il tuo messaggio è stato approvato","reviewable_items":"elementi in attesa di revisione","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} e {{count}} altri\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} e {{count}} altri\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"ha messo \"mi piace\" ad {{count}} tuo messaggio","other":"ha messo \"mi piace\" a {{count}} dei tuoi messaggi"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e ha accettato il tuo invito","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e spostato {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"Guadagnato '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eNuovo Argomento\u003c/span\u003e {{description}}","membership_request_accepted":"Iscrizione accettata in \u0026quot;{{group_name}}\u0026quot;","membership_request_consolidated":"{{count}} richieste di iscrizione aperte per \u0026#39;{{group_name}}\u0026#39;","group_message_summary":{"one":"{{count}} messaggi in arrivo nella casella {{group_name}}","other":"{{count}} messaggi in arrivo nella casella {{group_name}}"},"popup":{"mentioned":"{{username}} ti ha menzionato in \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} ti ha menzionato in \"{{topic}}\" - {{site_title}}","quoted":"{{username}} ti ha citato in \"{{topic}}\" - {{site_title}}","replied":"{{username}} ti ha risposto in \"{{topic}}\" - {{site_title}}","posted":"{{username}} ha pubblicato in \"{{topic}}\" - {{site_title}}","private_message":"{{username}} ti ha inviato un messaggio personale in \"{{topic}}\" - {{site_title}}","linked":"{{username}} ha aggiunto un collegamento a un tuo messaggio da \"{{topic}}\" - {{site_title}}","watching_first_post":"{{username}} ha creato il nuovo argomento \"{{topic}}\" - {{site_title}}","confirm_title":"Notifiche abilitate - %{site_title}","confirm_body":"Successo! Le notifiche sono state abilitate.","custom":"Notifica di {{username}} su %{site_title}"},"titles":{"mentioned":"menzionato","replied":"nuova risposta","quoted":"citato","edited":"modificato","liked":"nuovo \"mi piace\"","private_message":"nuovo messaggio privato","invited_to_private_message":"invitato ad un Messaggio Privato","invitee_accepted":"invito accettato","posted":"nuovo messaggio","moved_post":"messaggio spostato","linked":"linkato","bookmark_reminder":"promemoria segnalibro","bookmark_reminder_with_name":"promemoria segnalibro - %{name}","granted_badge":"distintivo assegnato","invited_to_topic":"invitato ad un Argomento","group_mentioned":"gruppo menzionato","group_message_summary":"nuovo messaggio di gruppo","watching_first_post":"nuovo argomento","topic_reminder":"promemoria Argomento","liked_consolidated":"nuovi \"Mi piace\"","post_approved":"messaggio approvato","membership_request_consolidated":"nuove richieste di iscrizione"}},"upload_selector":{"title":"Aggiungi un'immagine","title_with_attachments":"Aggiungi un'immagine o un file","from_my_computer":"Dal mio dispositivo","from_the_web":"Dal web","remote_tip":"collegamento all'immagine","remote_tip_with_attachments":"collegamento all'immagine o al file {{authorized_extensions}}","local_tip":"seleziona immagini dal tuo dispositivo","local_tip_with_attachments":"seleziona immagini o file dal tuo dispositivo {{authorized_extensions}}","hint":"(puoi anche trascinarle nell'editor per caricarle)","hint_for_supported_browsers":"puoi fare il \"trascina e rilascia\" o incollare immagini nell'editor","uploading":"In caricamento","select_file":"Seleziona File","default_image_alt_text":"immagine"},"search":{"sort_by":"Ordina per","relevance":"Rilevanza","latest_post":"Ultimo Messaggio","latest_topic":"Ultimo Argomento","most_viewed":"Più Visti","most_liked":"Con più \"Mi Piace\"","select_all":"Seleziona Tutto","clear_all":"Cancella Tutto","too_short":"La tua chiave di ricerca è troppo corta.","result_count":{"one":"\u003cspan\u003e%{count} risultato per\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","other":"\u003cspan\u003e{{count}}{{plus}} risultati per\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"title":"cerca argomenti, messaggi, utenti o categorie","full_page_title":"Cerca negli Argomenti o nei Messaggi","no_results":"Nessun risultato trovato.","no_more_results":"Nessun altro risultato trovato.","searching":"Ricerca in corso...","post_format":"#{{post_number}} da {{username}}","results_page":"Risultati della ricerca per '{{term}}'","more_results":"Ci sono più risultati. Restringi i criteri di ricerca.","cant_find":"Non riesci a trovare quello che stai cercando?","start_new_topic":"Forse vuoi avviare un nuovo argomento?","or_search_google":"O prova a cercare con Google invece:","search_google":"Prova a cercare con Google invece:","search_google_button":"Google","search_google_title":"Cerca nel sito","context":{"user":"Cerca messaggi di @{{username}}","category":"Cerca nella categoria #{{category}}","tag":"Cerca l'etichetta #{{tag}}","topic":"Cerca in questo argomento","private_messages":"Cerca messaggi"},"advanced":{"title":"Ricerca Avanzata","posted_by":{"label":"Pubblicato da"},"in_category":{"label":"Classificate"},"in_group":{"label":"Nel Gruppo"},"with_badge":{"label":"Con Distintivo"},"with_tags":{"label":"Con etichetta"},"filters":{"label":"Mostra solamente argomenti/messaggi...","title":"cerca solo nel titolo","likes":"su cui ho messo \"Mi Piace\"","posted":"ho pubblicato in","created":"ho creato","watching":"sto osservando","tracking":"sto seguendo","private":"nei miei messaggi privati","bookmarks":"ho aggiunto ai segnalibri","first":"sono il primissimo post","pinned":"sono appuntati","unpinned":"non sono appuntati","seen":"messaggi che ho letto","unseen":"non ho letto","wiki":"sono wiki","images":"che includono immagini","all_tags":"Tutte le etichette sopra"},"statuses":{"label":"In cui gli argomenti","open":"sono aperti","closed":"sono chiusi","public":"sono pubblici","archived":"sono archiviati","noreplies":"hanno zero risposte","single_user":"contengono un singolo utente"},"post":{"count":{"label":"Conteggio Messaggi Minimo"},"time":{"label":"Pubblicato","before":"prima del","after":"dopo il"}}}},"hamburger_menu":"vai ad un'altra lista di argomenti o categoria","new_item":"nuovo","go_back":"indietro","not_logged_in_user":"pagina utente con riassunto delle attività correnti e delle impostazioni","current_user":"vai alla pagina utente","view_all":"vedi tutto","topics":{"new_messages_marker":"ultima visita","bulk":{"select_all":"Seleziona Tutto","clear_all":"Deseleziona Tutto","unlist_topics":"Rendi invisibili","relist_topics":"Ripubblica Argomenti","reset_read":"Reimposta stato lettura","delete":"Elimina argomenti","dismiss":"Letti","dismiss_read":"Nascondi tutti i non letti","dismiss_button":"Nascondi...","dismiss_tooltip":"Nascondi solo i nuovi messaggi o smetti di seguire gli argomenti","also_dismiss_topics":"Smetti di seguire questi argomenti così che non compariranno più come non letti per me","dismiss_new":"Nascondi i Nuovi","toggle":"commuta la selezione multipla degli argomenti","actions":"Azioni Multiple","change_category":"Imposta categoria","close_topics":"Chiudi argomenti","archive_topics":"Archivia argomenti","notification_level":"Notifiche","choose_new_category":"Scegli la nuova categoria per gli argomenti:","selected":{"one":"Hai selezionato \u003cb\u003e%{count}\u003c/b\u003e argomento.","other":"Hai selezionato \u003cb\u003e{{count}}\u003c/b\u003e argomenti."},"change_tags":"Sostituire Etichette","append_tags":"Aggiungi Etichette","choose_new_tags":"Scegli nuove etichette per i seguenti argomenti:","choose_append_tags":"Scegli nuove etichette da aggiungere a questi argomenti:","changed_tags":"Le etichette per quegli argomenti sono state cambiate."},"none":{"unread":"Non ci sono argomenti non letti.","new":"Non ci sono nuovi argomenti.","read":"Non hai ancora letto nessun argomento.","posted":"Non hai ancora scritto in nessun argomento.","latest":"Non ci sono argomenti più recenti. Ciò è triste.","bookmarks":"Non hai ancora argomenti nei segnalibri.","category":"Non ci sono argomenti in {{category}}.","top":"Non ci sono argomenti di punta.","educate":{"new":"\u003cp\u003eQui compaiono i nuovi argomenti.\u003c/p\u003e\u003cp\u003ePer difetto, gli argomenti vengono considerati nuovi e mostrano l'indicatore \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enuovo\u003c/span\u003e se sono stati creati negli ultimi 2 giorni.\u003c/p\u003e\u003cp\u003ePuoi cambiare questa configurazione nelle tue \u003ca href=\"%{userPrefsUrl}\"\u003epreferenze\u003c/a\u003e.\u003c/p\u003e","unread":"\u003cp\u003eQui compaiono gli argomenti che non hai letto.\u003c/p\u003e\u003cp\u003ePer difetto, gli argomenti sono considerati non letti e ne viene mostrato un conteggio \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e se hai:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCreato l'argomento\u003c/li\u003e\u003cli\u003eRisposto all'argomento\u003c/li\u003e\u003cli\u003eLetto l'argomento per più di 4 minuti\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOppure se hai esplicitamente impostato l'argomento come Seguito o Osservato usando il pannello delle notifiche in fondo ad ogni argomento.\u003c/p\u003e\u003cp\u003ePuoi cambiare questa configurazione nelle tue \u003ca href=\"%{userPrefsUrl}\"\u003epreferenze\u003c/a\u003e.\u003c/p\u003e"}},"bottom":{"latest":"Non ci sono altri argomenti più recenti.","posted":"Non ci sono altri argomenti pubblicati.","read":"Non ci sono altri argomenti letti.","new":"Non ci sono altri argomenti nuovi.","unread":"Non ci sono altri argomenti non letti","category":"Non ci sono altri argomenti nella categoria {{category}}.","top":"Non ci sono altri argomenti di punta.","bookmarks":"Non ci sono ulteriori argomenti nei segnalibri."}},"topic":{"filter_to":{"one":"%{count} messaggio in questo argomento","other":"{{count}} messaggi in questo argomento"},"create":"Nuovo Argomento","create_long":"Crea un nuovo Argomento","open_draft":"Apri Bozza","private_message":"Inizia a scrivere un messaggio","archive_message":{"help":"Sposta il messaggio nel tuo archivio","title":"Archivia"},"move_to_inbox":{"title":"Sposta in arrivo","help":"Sposta il messaggio di nuovo nella posta in arrivo"},"edit_message":{"help":"Modifica la prima versione del Messaggio","title":"Modifica Messaggio"},"defer":{"help":"Contrassegna come non letto","title":"Rinvia"},"feature_on_profile":{"help":"Aggiungi un collegamento a questo argomento sulla tua scheda utente e sul tuo profilo","title":"Feature Sul Profilo"},"remove_from_profile":{"warning":"Il tuo profilo ha già un argomento in primo piano. Se continui, questo argomento sostituirà l'argomento esistente.","help":"Rimuovi il collegamento a questo argomento dal tuo profilo utente","title":"Rimuovi Dal Profilo"},"list":"Argomenti","new":"nuovo argomento","unread":"non letto","new_topics":{"one":"%{count} nuovo argomento","other":"{{count}} nuovi argomenti"},"unread_topics":{"one":"%{count} argomento non letto","other":"{{count}} argomenti non letti"},"title":"Argomento","invalid_access":{"title":"L'argomento è privato","description":"Spiacenti, non puoi accedere a questo argomento!","login_required":"Devi connetterti per vedere questo argomento."},"server_error":{"title":"Errore di caricamento dell'argomento","description":"Spiacenti, non è stato possibile caricare questo argomento, probabilmente per un errore di connessione. Per favore riprova. Se il problema persiste, faccelo sapere."},"not_found":{"title":"Argomento non trovato","description":"Spiacenti, non abbiamo trovato l'argomento. Forse è stato rimosso da un moderatore?"},"total_unread_posts":{"one":"c'è un post non letto in questa discussione","other":"hai {{count}} messagi non letti in questo argomento"},"unread_posts":{"one":"Hai %{count} vecchio messaggio non letto in questo argomento","other":"hai {{count}} vecchi messaggi non letti in questo argomento"},"new_posts":{"one":"c'è %{count} nuovo messaggio in questo argomento dalla tua ultima lettura","other":"ci sono {{count}} nuovi messaggi in questo argomento dalla tua ultima lettura"},"likes":{"one":"c'è %{count} \"Mi piace\" in questo argomento","other":"ci sono {{count}} \"Mi piace\" in questo argomento"},"back_to_list":"Torna alla Lista Argomenti","options":"Opzioni Argomento","show_links":"mostra i collegamenti in questo argomento","toggle_information":"commuta i dettagli dell'argomento","read_more_in_category":"Vuoi saperne di più? Leggi altri argomenti in {{catLink}} o {{latestLink}}.","read_more":"Vuoi saperne di più? {{catLink}} o {{latestLink}}.","group_request":"Per vedere questo Argomento devi richiedere l\u0026#39;iscrizioneal gruppo `{{name}}`","group_join":"È necessario iscriversi al gruppo `{{name}}` per visualizzare questo Argomento","group_request_sent":"La tua richiesta di iscrizione al gruppo è stata inviata. Sarai informato quando sarà accettato.","unread_indicator":"Nessun utente ha ancora letto l\u0026#39;ultimo post di questo Argomento.","browse_all_categories":"Scorri tutte le categorie","view_latest_topics":"visualizza gli argomenti più recenti","suggest_create_topic":"Perché non crei un argomento?","jump_reply_up":"passa a una risposta precedente","jump_reply_down":"passa a una risposta successiva","deleted":"L'argomento è stato eliminato","topic_status_update":{"title":"Timer Argomento","save":"Imposta Timer","num_of_hours":"Numero di ore:","num_of_days":"Numero di giorni:","remove":"Rimuovi Timer","publish_to":"Pubblica Su:","when":"Quando:","public_timer_types":"Timer Argomento","private_timer_types":"Timer Argomento per Utente","time_frame_required":"Per favore, seleziona un lasso di tempo"},"auto_update_input":{"none":"Seleziona un lasso di tempo","later_today":"Più tardi oggi","tomorrow":"Domani","later_this_week":"Più tardi questa settimana","this_weekend":"Questo fine settimana","next_week":"La prossima settimana","two_weeks":"Due Settimane","next_month":"Il prossimo mese","two_months":"Due mesi","three_months":"Tre Mesi","four_months":"Quattro mesi","six_months":"Sei Mesi","one_year":"Un Anno","forever":"Per sempre","pick_date_and_time":"Scegli la data e l'ora","set_based_on_last_post":"Chiudi in base all'ultimo messaggio"},"publish_to_category":{"title":"Pianifica Pubblicazione"},"temp_open":{"title":"Apri Temporaneamente"},"auto_reopen":{"title":"Apri automaticamente Argomento"},"temp_close":{"title":"Chiudi Temporaneamente"},"auto_close":{"title":"Chiudi Automaticamente","label":"Ore per la chiusura automatica:","error":"Per favore inserisci un valore valido.","based_on_last_post":"Non chiudere finché l'ultimo messaggio nell'argomento non ha questa anzianità."},"auto_delete":{"title":"Elimina Automaticamente Argomento"},"auto_bump":{"title":"Riproponi automaticamente l’argomento"},"reminder":{"title":"Ricordamelo"},"auto_delete_replies":{"title":"Elimina Automaticamente Risposte"},"status_update_notice":{"auto_open":"Questo argomento verrà automaticamente aperto %{timeLeft}","auto_close":"Questo argomento si chiuderà automaticamente in %{timeLeft}.","auto_publish_to_category":"Questo argomento verrà pubblicato su \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e%{timeLeft}","auto_close_based_on_last_post":"Questo argomento si chiuderà %{duration}dopo l'ultima risposta.","auto_delete":"Questo argomento verrà automaticamente cancellato %{timeLeft}.","auto_bump":"Questo argomento sarà riproposto automaticamente %{timeLeft}.","auto_reminder":"Questo argomento ti verrà ricordato %{timeLeft}.","auto_delete_replies":"Le risposte in questo argomento vengono automaticamente cancellate dopo %{duration}."},"auto_close_title":"Impostazioni di auto-chiusura","auto_close_immediate":{"one":"L'ultimo messaggio nell'argomento ha già %{count} ora, per cui l'argomento verrà chiuso immediatamente.","other":"L'ultimo messaggio nell'argomento ha già %{count} ore, per cui l'argomento verrà chiuso immediatamente."},"timeline":{"back":"Indietro","back_description":"Torna indietro al tuo ultimo messaggio non letto","replies_short":"%{current} / %{total}"},"progress":{"title":"Avanzamento dell'argomento","go_top":"alto","go_bottom":"basso","go":"vai","jump_bottom":"salta all'ultimo messaggio","jump_prompt":"vai a...","jump_prompt_of":"di %{count} messaggi","jump_prompt_long":"Salta a...","jump_bottom_with_number":"Passa al messaggio %{post_number}","jump_prompt_to_date":"ad oggi","jump_prompt_or":"o","total":"totale messaggi","current":"messaggio corrente"},"notifications":{"title":"cambia la frequenza con cui sarai avvertito su questo argomento","reasons":{"mailing_list_mode":"Hai la modalità mailing list abilitata, verrai notificato delle risposte a questo argomento via email.","3_10":"Riceverai notifiche perché stai osservando un'etichetta in questo argomento.","3_6":"Riceverai notifiche perché stai osservando questa categoria.","3_5":"Riceverai notifiche poiché hai iniziato ad osservare questo argomento automaticamente.","3_2":"Riceverai notifiche perché stai osservando questo argomento.","3_1":"Riceverai notifiche perché hai creato questo argomento.","3":"Riceverai notifiche perché stai osservando questo argomento.","2_8":"Vedrai un conteggio delle nuove risposte perché stai seguendo questa categoria.","2_4":"Vedrai un conteggio delle nuove risposte perché hai pubblicato una risposta in questo argomento.","2_2":"Vedrai un conteggio delle nuove risposte perché stai seguendo questo argomento.","2":"Vedrai un conteggio delle nuove risposte perché \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003ehai letto questo argomento\u003c/a\u003e.","1_2":"Riceverai notifiche se qualcuno menziona il tuo @nome o ti risponde.","1":"Riceverai notifiche se qualcuno menziona il tuo @nome o ti risponde.","0_7":"Stai ignorando tutte le notifiche di questa categoria.","0_2":"Stai ignorando tutte le notifiche di questo argomento.","0":"Stai ignorando tutte le notifiche di questo argomento."},"watching_pm":{"title":"In osservazione","description":"Riceverai una notifica per ogni nuova risposta a questo messaggio, e comparirà un conteggio delle nuove risposte."},"watching":{"title":"In osservazione","description":"Riceverai una notifica per ogni nuova risposta in questo argomento, e comparirà un conteggio delle nuove risposte."},"tracking_pm":{"title":"Seguito","description":"Per questo messaggio apparirà un conteggio delle nuove risposte. Riceverai una notifica se qualcuno menziona il tuo @nome o ti risponde."},"tracking":{"title":"Seguito","description":"Per questo argomento apparirà un conteggio delle nuove risposte. Riceverai una notifica se qualcuno menziona il tuo @nome o ti risponde."},"regular":{"title":"Normale","description":"Riceverai una notifica se qualcuno menziona il tuo @nome o ti risponde."},"regular_pm":{"title":"Normale","description":"Riceverai una notifica se qualcuno menziona il tuo @nome o ti risponde."},"muted_pm":{"title":"Silenziato","description":"Non ti verrà notificato nulla per questo messaggio."},"muted":{"title":"Silenziato","description":"Non riceverai mai notifiche o altro circa questo argomento e non apparirà nei recenti."}},"actions":{"title":"Azioni","recover":"Ripristina Argomento","delete":"Cancella Argomento","open":"Apri Argomento","close":"Chiudi Argomento","multi_select":"Seleziona Messaggi...","timed_update":"Imposta Timer...","pin":"Appunta Argomento...","unpin":"Spunta Argomento...","unarchive":"De-archivia Argomento","archive":"Archivia Argomento","invisible":"Rendi Invisibile","visible":"Rendi Visibile","reset_read":"Reimposta Dati Letti","make_public":"Rendi Argomento Pubblico","make_private":"Rendi Messaggio Personale","reset_bump_date":"Reimposta la data di riproposizione"},"feature":{"pin":"Appunta Argomento","unpin":"Spunta Argomento","pin_globally":"Appunta Argomento Globalmente","make_banner":"Argomento Annuncio","remove_banner":"Rimuovi Argomento Annuncio"},"reply":{"title":"Rispondi","help":"inizia a comporre una risposta a questo argomento"},"clear_pin":{"title":"Spunta","help":"Rimuovi la spunta da questo argomento, così non comparirà più in cima alla lista degli argomenti"},"share":{"title":"Condividi","extended_title":"Condividi un collegamento","help":"condividi un collegamento a questo argomento"},"print":{"title":"Stampa","help":"Apri una versione da stampabile di questo argomento"},"flag_topic":{"title":"Segnala","help":"segnala questo argomento o invia una notifica privata","success_message":"Hai segnalato questo argomento con successo."},"make_public":{"title":"Converti in argomento pubblico","choose_category":"Scegli una categoria per l'argomento pubblico:"},"feature_topic":{"title":"Poni argomento in primo piano","pin":"Poni questo argomento in cima alla categoria {{categoryLink}} fino a","confirm_pin":"Hai già {{count}} argomenti puntati. Troppi argomenti puntati potrebbero essere un peso per gli utenti nuovi o anonimi. Sicuro di voler puntare un altro argomento in questa categoria?","unpin":"Rimuovi questo argomento dalla cima della categoria {{categoryLink}}.","unpin_until":"Rimuovi questo argomento dalla cima della categoria {{categoryLink}} o attendi fino a \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Gli utenti possono spuntare gli argomenti individualmente per loro stessi.","pin_validation":"È richiesta una data per appuntare questo argomento.","not_pinned":"Non ci sono argomenti appuntati in {{categoryLink}}.","already_pinned":{"one":"Argomenti attualmente appuntati in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Argomenti attualmente appuntati in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Poni questo argomento in cima a tutte le liste di argomenti fino a","confirm_pin_globally":"Hai già {{count}} argomenti puntati globalmente. Troppi argomenti puntati potrebbero essere un peso per gli utenti nuovi o anonimi. Sicuro di voler puntare un altro argomento globalmente?","unpin_globally":"Togli questo argomento dalla cima degli altri argomenti.","unpin_globally_until":"Rimuovi questo argomento dalla cima di tutte le liste di argomenti o attendi fino a \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Gli utenti possono spuntare gli argomenti autonomamente per loro stessi.","not_pinned_globally":"Non ci sono argomenti appuntati globalmente.","already_pinned_globally":{"one":"Argomenti attualmente appuntati globalmente: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Argomenti attualmente appuntati globalmente: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Rendi questo argomento uno striscione che apparirà in cima a tutte le pagine.","remove_banner":"Rimuovi lo striscione che appare in cima a tutte le pagine.","banner_note":"Gli utenti possono nascondere l'annuncio chiudendolo. Solo un argomento per volta può diventare un annuncio.","no_banner_exists":"Non c'è alcun argomento annuncio.","banner_exists":"\u003cstrong class='badge badge-notification unread'\u003eC'è\u003c/strong\u003e attualmente un argomento annuncio."},"inviting":"Sto invitando...","automatically_add_to_groups":"Questo invito include anche l'accesso ai seguenti gruppi:","invite_private":{"title":"Invita al Messaggio","email_or_username":"Email o Utente di chi invita","email_or_username_placeholder":"indirizzo email o nome utente","action":"Invita","success":"Abbiamo invitato l'utente a partecipare a questo messaggio.","success_group":"Abbiamo invitato il gruppo a partecipare a questo messaggio.","error":"Spiacenti, si è verificato un errore durante l'invito dell'utente.","group_name":"nome gruppo"},"controls":"Impostazioni Argomento","invite_reply":{"title":"Invita","username_placeholder":"nome utente","action":"Invia Invito","help":"invita altri su questo argomento via email o tramite notifiche","to_forum":"Invieremo una breve email che permetterà al tuo amico di partecipare subito cliccando un collegamento, senza bisogno di connettersi.","sso_enabled":"Inserisci il nome utente della persona che vorresti invitare su questo argomento.","to_topic_blank":"Inserisci il nome utente o l'indirizzo email della persona che vorresti invitare su questo argomento.","to_topic_email":"Hai inserito un indirizzo email. Invieremo una email di invito che permetterà al tuo amico di rispondere subito a questo argomento.","to_topic_username":"Hai inserito un nome utente. Gli invieremo una notifica con un collegamento per invitarlo su questo argomento.","to_username":"Inserisci il nome utente della persona che vorresti invitare. Gli invieremo una notifica con un collegamento di invito a questo argomento.","email_placeholder":"nome@esempio.com","success_email":"Abbiamo inviato un invito via email a \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Ti avvertiremo quando l'invito verrà riscattato. Controlla la sezione \"inviti\" sulla tua pagina utente per tracciarne lo stato.","success_username":"Abbiamo invitato l'utente a partecipare all'argomento.","error":"Spiacenti, non siamo riusciti ad invitare questa persona. E' stata per caso già invitata (gli inviti sono limitati)? ","success_existing_email":"Esiste già un utente con email \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Lo abbiamo invitato a partecipare a questo argomento."},"login_reply":"Connettiti per Rispondere","filters":{"n_posts":{"one":"%{count} post","other":"{{count}} messaggi"},"cancel":"Rimuovi filtro"},"move_to":{"title":"Sposta in","action":"sposta in","error":"Si è verificato un errore spostando i messaggi."},"split_topic":{"title":"Sposta in un nuovo argomento","action":"sposta in un nuovo argomento","topic_name":"Titolo del nuovo Argomento","radio_label":"Nuovo Argomento","error":"Si è verificato un errore spostando il messaggio nel nuovo argomento.","instructions":{"one":"Stai per creare un nuovo argomento riempiendolo con il messaggio che hai selezionato.","other":"Stai per creare un nuovo argomento riempiendolo con i \u003cb\u003e{{count}}\u003c/b\u003e messaggi che hai selezionato."}},"merge_topic":{"title":"Sposta in Argomento Esistente","action":"sposta in un argomento esistente","error":"Si è verificato un errore nello spostare i messaggi nell'argomento.","radio_label":"Argomento Esistente","instructions":{"one":"Per favore scegli l'argomento dove spostare il messaggio.","other":"Per favore scegli l'argomento di destinazione dove spostare i \u003cb\u003e{{count}}\u003c/b\u003e messaggi."}},"move_to_new_message":{"title":"Sposta in un nuovo messaggio","action":"sposta in un nuovo messaggio","message_title":"Titolo del nuovo messaggio","radio_label":"Nuovo messaggio","participants":"Partecipanti","instructions":{"one":"Stai per creare un nuovo messaggio e popolarlo con il messaggio che hai selezionato.","other":"Stai per creare un nuovo messaggio e popolarlo con i \u003cb\u003e{{count}}\u003c/b\u003e messaggi che hai selezionato."}},"move_to_existing_message":{"title":"Sposta in un messaggio esistente","action":"sposta in un messaggio esistente","radio_label":"Messaggio Esistente","participants":"Partecipanti","instructions":{"one":"Scegli il messaggio verso il quale vorresti spostare questo messaggio.","other":"Scegli il messaggio verso il quale vorresti spostare quei \u003cb\u003e{{count}}\u003c/b\u003e messaggi."}},"merge_posts":{"title":"Unisci Messaggi Selezionati","action":"unisci messaggi selezionati","error":"Si è verificato un errore nell'unire i messaggi selezionati."},"publish_page":{"title":"Pubblicazione Pagine","publish":"Pubblica","description":"Quando un argomento viene pubblicato come pagina, l'URL può essere condiviso e verrà visualizzato con uno stile personalizzato.","slug":"Abbreviazione","publish_url":"La tua pagina è stata pubblicata su:","topic_published":"Il tuo argomento è stato pubblicato su:","preview_url":"La tua pagina sarà pubblicata su:","invalid_slug":"Spiacenti, non puoi pubblicare questa pagina.","unpublish":"Non pubblicato","unpublished":"La tua pagina non è stata pubblicata e non è più accessibile.","publishing_settings":"Impostazioni di Pubblicazione"},"change_owner":{"title":"Cambia Proprietario","action":"cambia proprietà","error":"Si è verificato un errore durante il cambio di proprietà dei messaggi.","placeholder":"nome utente del nuovo proprietario","instructions":{"one":"Per favore, scegli un nuovo proprietario per il messaggio che apparteneva a \u003cb\u003e@{{old_user}}\u003c/b\u003e","other":"Per favore, scegli un nuovo proprietario per i {{count}} messaggi che appartenevano a \u003cb\u003e@{{old_user}}\u003c/b\u003e"},"instructions_without_old_user":{"one":"Scegli un nuovo proprietario per il messaggio","other":"Scegli un nuovo proprietario per i {{count}} messaggi"}},"change_timestamp":{"title":"Cambia Marca Temporale...","action":"cambia marca temporale","invalid_timestamp":"Il timestamp non può essere nel futuro.","error":"Errore durante la modifica del timestamp dell'argomento.","instructions":"Seleziona il nuovo timestamp per l'argomento. I messaggi nell'argomento saranno aggiornati in modo che abbiano lo stesso intervallo temporale."},"multi_select":{"select":"scegli","selected":"selezionati ({{count}})","select_post":{"label":"seleziona","title":"Aggiungi il messaggio alla selezione"},"selected_post":{"label":"selezionato","title":"Clicca per rimuovere un messaggio dalla selezione"},"select_replies":{"label":"seleziona +risposte","title":"Aggiungi il messaggio e tutte le risposte alla selezione"},"select_below":{"label":"seleziona +seguenti","title":"Aggiungi questo messaggio e tutti quelli seguenti alla selezione"},"delete":"elimina i selezionati","cancel":"annulla selezione","select_all":"seleziona tutto","deselect_all":"deseleziona tutto","description":{"one":"Hai selezionato \u003cb\u003e%{count}\u003c/b\u003e messaggio.","other":"Hai selezionato \u003cb\u003e{{count}}\u003c/b\u003e messaggi."}},"deleted_by_author":{"one":"(Argomento eliminato dall'autore, verrà automaticamente cancellato in %{count} ora, se non segnalato)","other":"(Argomento eliminato dall'autore, verrà automaticamente cancellato in %{count} ore, se non segnalato)"}},"post":{"quote_reply":"Cita","edit_reason":"Motivo:","post_number":"messaggio {{number}}","ignored":"Contenuto ignorato","wiki_last_edited_on":"ultima modifica alla wiki","last_edited_on":"ultima modifica al messaggio:","reply_as_new_topic":"Rispondi come Argomento collegato","reply_as_new_private_message":"Rispondi come nuovo messaggio agli stessi destinatari","continue_discussion":"Continua la discussione da {{postLink}}:","follow_quote":"vai al messaggio citato","show_full":"Mostra Messaggio Completo","show_hidden":"Visualizza contenuto ignorato","deleted_by_author":{"one":"(post eliminato dall'autore, sarà automaticamente cancellato in %{count} ore se non contrassegnato)","other":"(messaggio eliminato dall'autore, verrà automaticamente cancellato in %{count} ore se non segnalato)"},"collapse":"raggruppa","expand_collapse":"espandi/raggruppa","locked":"un membro dello Staff ha bloccato le modifiche a questo messaggio","gap":{"one":"visualizza %{count} risposta nascosta","other":"visualizza {{count}} riposte nascoste"},"notice":{"new_user":"E' la prima volta che {{user}} invia un messaggio. Diamogli il benvenuto nella nostra comunità!","returning_user":"Era da un bel po' che {{user}} non si faceva vedere: l'ultimo messaggio risale a {{time}}."},"unread":"Messaggio non letto","has_replies":{"one":"{{count}} Risposta","other":"{{count}} Risposte"},"has_likes_title":{"one":"Una persona ha messo \"Mi piace\" a questo messaggio","other":"{{count}} persone hanno messo \"Mi piace\" a questo messaggio"},"has_likes_title_only_you":"hai messo \"Mi piace\" a questo messaggio","has_likes_title_you":{"one":"tu e un'altra persona avete messo \"Mi piace\" a questo messaggio","other":"tu e altre {{count}} persone avete messo \"Mi piace\" a questo messaggio"},"errors":{"create":"Spiacenti, si è verificato un errore nel creare il tuo messaggio. Prova di nuovo.","edit":"Spiacenti, si è verificato un errore nel modificare il tuo messaggio. Prova di nuovo.","upload":"Spiacenti, si è verificato un errore durante il caricamento del file. Prova di nuovo.","file_too_large":"Spiacenti, ma questo file è troppo grande (la dimensione massima è {{max_size_kb}}kb). Perché non lo carichi su un servizio di cloud sharing per poi incollarne qui il collegamento?","too_many_uploads":"Spiacenti, puoi caricare un solo file per volta.","too_many_dragged_and_dropped_files":"Spiacenti, puoi caricare solo {{max}} file contemporaneamente.","upload_not_authorized":"Spiacenti, il file che stai cercando di caricare non è autorizzato (estensioni autorizzate: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Spiacenti, i nuovi utenti non possono caricare immagini.","attachment_upload_not_allowed_for_new_user":"Spiacenti, i nuovi utenti non possono caricare allegati.","attachment_download_requires_login":"Spiacenti, devi essere connesso per poter scaricare gli allegati."},"abandon_edit":{"confirm":"Sei sicuro di voler annullare le modifiche?","no_value":"No, mantieni","no_save_draft":"No, salva in bozza","yes_value":"Sì, scarta le modifiche"},"abandon":{"confirm":"Sicuro di voler abbandonare il tuo messaggio?","no_value":"No, mantienilo","no_save_draft":"No, salva in bozza","yes_value":"Si, abbandona"},"via_email":"questo messaggio è arrivato via email","via_auto_generated_email":"questo messaggio è arrivato tramite una email auto generata","whisper":"questo messaggio è un sussurro privato per i moderatori","wiki":{"about":"questo messaggio è una wiki"},"archetypes":{"save":"Opzioni di salvataggio"},"few_likes_left":"Grazie per aver condiviso l'amore! Hai ancora pochi \"Mi piace\" rimasti per oggi.","controls":{"reply":"inizia a comporre una risposta a questo messaggio","like":"metti \"Mi piace\" al messaggio","has_liked":"ti è piaciuto questo messaggio","read_indicator":"utenti che leggono questo messaggio","undo_like":"rimuovi il \"Mi piace\"","edit":"modifica questo messaggio","edit_action":"Modifica","edit_anonymous":"Spiacenti, devi essere connesso per poter modificare questo messaggio.","flag":"segnala privatamente questo messaggio o invia una notifica privata","delete":"cancella questo messaggio","undelete":"recupera questo messaggio","share":"condividi un collegamento a questo messaggio","more":"Di più","delete_replies":{"confirm":"Vuoi eliminare anche le risposte a questo messaggio?","direct_replies":{"one":"Sì, e %{count} risposta diretta","other":"Sì, e le {{count}} risposte dirette"},"all_replies":{"one":"Sì, e %{count} risposta.","other":"Sì, e tutte le {{count}} risposte"},"just_the_post":"No, solo questo messaggio"},"admin":"azioni post-amministrazione","wiki":"Rendi Wiki","unwiki":"Rimuovi Wiki","convert_to_moderator":"Aggiungi Colore Staff","revert_to_regular":"Rimuovi Colore Staff","rebake":"Ricrea HTML","publish_page":"Pubblicazione Pagine","unhide":"Mostra nuovamente","change_owner":"Cambia Proprietà","grant_badge":"Assegna Distintivo","lock_post":"Blocca Messaggio","lock_post_description":"impedisci all'autore di modificare questo messaggio","unlock_post":"Sblocca messaggio","unlock_post_description":"consenti all'autore di modificare questo messaggio","delete_topic_disallowed_modal":"Non hai il permesso di eliminare questo Argomento. Se davvero lo vuoi eliminare, segnalalo all'attenzione dei moderatori spiegando le tue motivazioni.","delete_topic_disallowed":"non hai il permesso di eliminare questo argomento","delete_topic":"elimina argomento","add_post_notice":"Aggiungi Note Staff","remove_post_notice":"Rimuovi Note Staff","remove_timer":"rimuovi il timer"},"actions":{"flag":"Segnala","defer_flags":{"one":"Ignore flag","other":"Ignora le segnalazioni"},"undo":{"off_topic":"Rimuovi segnalazione","spam":"Rimuovi segnalazione","inappropriate":"Rimuovi segnalazione","bookmark":"Annulla segnalibro","like":"Annulla il \"Mi piace\""},"people":{"off_topic":"l'hanno segnalato come fuori tema","spam":"l'hanno segnalato come spam","inappropriate":"l'hanno segnalato come inappropriato","notify_moderators":"hanno informato i moderatori","notify_user":"hanno inviato un messaggio","bookmark":"l'hanno aggiunto ai segnalibri","like":{"one":"ha messo \"Mi piace\"","other":"ha messo \"Mi piace\""},"read":{"one":"ha letto","other":"ha letto"},"like_capped":{"one":"e a {{count}} persona è piaciuto","other":"e ad altre {{count}} persone è piaciuto"},"read_capped":{"one":"e {{count}} ha letto","other":"e altri {{count}} hanno letto"}},"by_you":{"off_topic":"L'hai segnalato come fuori tema","spam":"L'hai segnalato come spam","inappropriate":"L'hai segnalato come inappropriato","notify_moderators":"L'hai segnalato per la moderazione","notify_user":"Hai inviato un messaggio a questo utente","bookmark":"Hai inserito questo messaggio nei segnalibri","like":"Ti piace"}},"delete":{"confirm":{"one":"Vuoi davvero eliminare quel messaggio?","other":"Vuoi davvero eliminare questi {{count}} messaggi?"}},"merge":{"confirm":{"one":"Sicuro di voler unire questi messaggi?","other":"Sicuro di voler unire questi {{count}} messaggi?"}},"revisions":{"controls":{"first":"Prima revisione","previous":"Revisione precedente","next":"Prossima revisione","last":"Ultima revisione","hide":"Nascondi revisione","show":"Mostra revisione","revert":"Ritorna a questa revisione","edit_wiki":"Modifica Wiki","edit_post":"Modifica Messaggio","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Mostra il risultato con le aggiunte e le rimozioni in linea","button":"HTML"},"side_by_side":{"title":"Mostra le differenze del risultato fianco a fianco","button":"HTML"},"side_by_side_markdown":{"title":"Mostra le differenze nei sorgenti fianco-a-fianco","button":"Sorgente"}}},"raw_email":{"displays":{"raw":{"title":"Mostra la sorgente della email","button":"Sorgente"},"text_part":{"title":"Mostra la parte testuale della email","button":"Testo"},"html_part":{"title":"Mostra la parte html della email","button":"HTML"}}},"bookmarks":{"create":"Crea un segnalibro","edit":"Modifica Segnalibro","created":"Creazione","name":"Nome","name_placeholder":"A cosa serve questo segnalibro?","set_reminder":"Ricordamelo","actions":{"delete_bookmark":{"name":"Cancella segnalibro","description":"Rimuove il segnalibro dal tuo profilo e interrompe tutti i promemoria per il segnalibro"},"edit_bookmark":{"name":"Modifica Segnalibro","description":"Modifica il nome del segnalibro o modifica la data e l'ora del promemoria"}}}},"category":{"can":"può\u0026hellip;","none":"(nessuna categoria)","all":"Tutte le categorie","choose":"categoria\u0026hellip;","edit":"Modifica","edit_dialog_title":"Modifica: %{categoryName}","view":"Visualizza Argomenti della Categoria","general":"Generale","settings":"Impostazioni","topic_template":"Modello di Argomento","tags":"Etichette","tags_allowed_tags":"Limita queste Etichette a questa Categoria:","tags_allowed_tag_groups":"Limita questi gruppi di Etichette a questa Categoria:","tags_placeholder":"Elenco (opzionale) delle etichette permesse","tags_tab_description":"Le etichette e i gruppi di etichette sopra specificati saranno disponibili solo in questa categoria e nelle altre categorie che li specificano. Non saranno disponibili per l'uso in altre categorie.","tag_groups_placeholder":"Elenco (opzionale) dei gruppi di etichette permessi","manage_tag_groups_link":"Gestisci qui i gruppi di Etichette.","allow_global_tags_label":"Consenti anche ulteriori Etichette","tag_group_selector_placeholder":"(Facoltativo) Gruppo di Etichette","required_tag_group_description":"Rendi obbligatorio per i nuovi argomenti avere un'Etichetta da un Gruppo di Etichette:","min_tags_from_required_group_label":"Numero Etichette:","required_tag_group_label":"Gruppo di Etichette:","topic_featured_link_allowed":"Consenti collegamenti in primo piano in questa categoria","delete":"Elimina Categoria","create":"Crea Categoria","create_long":"Crea una nuova categoria","save":"Salva Categoria","slug":"Abbreviazione della categoria","slug_placeholder":"(Facoltativo) parole-sillabate per URL","creation_error":"Si è verificato un errore nella creazione della categoria.","save_error":"Si è verificato un errore durante il salvataggio della categoria.","name":"Nome Categoria","description":"Descrizione","topic":"argomento della categoria","logo":"Immagine Categoria","background_image":"Immagine di sfondo della categoria","badge_colors":"Colori dei distintivi","background_color":"Colore di sfondo","foreground_color":"Colore in primo piano","name_placeholder":"Una o due parole al massimo","color_placeholder":"Qualsiasi colore web","delete_confirm":"Sei sicuro di voler cancellare questa categoria?","delete_error":"Si è verificato un errore durante la cancellazione della categoria.","list":"Elenca Categorie","no_description":"Aggiungi una descrizione alla categoria.","change_in_category_topic":"Modifica Descrizione","already_used":"Questo colore è già stato usato in un'altra categoria.","security":"Sicurezza","special_warning":"Attenzione: questa è una categoria predefinita e le impostazioni di sicurezza ne vietano la modifica. Se non vuoi usare questa categoria, cancellala invece di modificarla.","uncategorized_security_warning":"Questa è una Categoria speciale. È utilizzata come area di parcheggio per gli Argomenti senza Categoria. Non può avere impostazioni di sicurezza.","uncategorized_general_warning":"Questa è una Categoria speciale. È usata come Categoria predefinita per i nuovi Argomenti senza una Categoria selezionata. Se vuoi prevenire questo comportamento e forzare la scelta di una Categoria, \u003ca href=\"%{settingLink}\"\u003eper favore disabilita l'impostazione qui\u003c/a\u003e. Se vuoi cambiare il nome o la descrizione, vai a \u003ca href=\"%{customizeLink}\"\u003ePersonalizza / Contenuto Testuale\u003c/a\u003e.","pending_permission_change_alert":"Non hai aggiunto %{group} a questa categoria; fai clic su questo pulsante per aggiungerlo.","images":"Immagini","email_in":"Indirizzo email personalizzato:","email_in_allow_strangers":"Accetta email da utenti anonimi senza alcun account","email_in_disabled":"Le Impostazioni Sito non permettono di creare nuovi argomenti via email. Per abilitare la creazione di argomenti via email,","email_in_disabled_click":"abilita l'impostazione \"email entrante\".","mailinglist_mirror":"La categoria si comporta come una mailing list","show_subcategory_list":"Mostra la lista delle sottocategorie sopra agli argomenti in questa categoria.","num_featured_topics":"Numero degli argomenti mostrati nella pagina categorie:","subcategory_num_featured_topics":"Numero degli argomenti in evidenza nella pagina della categoria superiore","all_topics_wiki":"Rendi i nuovi argomenti automaticamente delle wiki","subcategory_list_style":"Stile Lista Sottocategorie:","sort_order":"Lista Argomenti Ordinata Per:","default_view":"Lista Argomenti Predefinita:","default_top_period":"Periodo Predefinito Argomenti Di Punta:","allow_badges_label":"Permetti l'assegnazione di distintivi in questa categoria","edit_permissions":"Modifica Permessi","reviewable_by_group":"Oltre che dallo staff, i messaggi e le segnalazioni in questa categoria possono essere revisionati da:","review_group_name":"nome gruppo","require_topic_approval":"Richiedi l'approvazione di un moderatore per tutti i nuovi argomenti","require_reply_approval":"Richiedi l'approvazione di un moderatore per tutte le nuove risposte","this_year":"quest'anno","position":"Posizione nella pagina delle Categorie:","default_position":"Posizione di default","position_disabled":"Le categorie verranno mostrate in ordine d'attività. Per modificare l'ordinamento delle categorie nelle liste,","position_disabled_click":"attiva l'impostazione \"posizione fissa delle categorie\".","minimum_required_tags":"Numero minimo di etichette richieste per argomento:","parent":"Categoria Superiore","num_auto_bump_daily":"Numero di argomenti aperti da riproporre automaticamente ogni giorno:","navigate_to_first_post_after_read":"Vai al primo messaggio dopo che gli argomenti vengono letti","notifications":{"watching":{"title":"In osservazione","description":"Osserverai automaticamente tutti gli argomenti in queste categorie. Riceverai notifiche per ogni nuovo messaggio in ogni argomento, e apparirà il conteggio delle nuove risposte."},"watching_first_post":{"title":"Osservando il Primo Messaggio","description":"Riceverai una notifica di nuovi argomenti in questa categoria, ma non per le risposte agli argomenti."},"tracking":{"title":"Seguendo","description":"Seguirai automaticamente tutti gli argomenti in tali categorie. Ti verrà inviata una notifica se qualcuno menziona il tuo @nome o ti risponde, e apparirà un conteggio delle nuove risposte."},"regular":{"title":"Normale","description":"Riceverai una notifica se qualcuno menziona il tuo @nome o ti risponde."},"muted":{"title":"Silenziato","description":"Non ti verrà mai notificato nulla sui nuovi argomenti di queste categorie, e non compariranno nell'elenco dei Non letti."}},"search_priority":{"label":"Priorità della ricerca","options":{"normal":"Normale","ignore":"Ignora","very_low":"Molto Bassa","low":"Bassa","high":"Alta","very_high":"Molto Alta"}},"sort_options":{"default":"predefinito","likes":"Mi piace","op_likes":"\"Mi Piace\" del Messaggio Originale","views":"Visualizzazioni","posts":"Messaggi","activity":"Attività","posters":"Partecipanti","category":"Categoria","created":"Creazione","votes":"Voti"},"sort_ascending":"Crescente","sort_descending":"Decrescente","subcategory_list_styles":{"rows":"Righe","rows_with_featured_topics":"Righe con argomenti in primo piano","boxes":"Box","boxes_with_featured_topics":"Box con argomenti in primo piano"},"settings_sections":{"general":"Generale","moderation":"Moderazione","appearance":"Aspetto","email":"Email"}},"flagging":{"title":"Grazie per aiutarci a mantenere la nostra comunità civile!","action":"Segnala Messaggio","take_action":"Procedi","notify_action":"Messaggio","official_warning":"Avvertimento Ufficiale","delete_spammer":"Cancella Spammer","yes_delete_spammer":"Sì, cancella lo spammer","ip_address_missing":"(N/D)","hidden_email_address":"(nascosto)","submit_tooltip":"Invia la segnalazione privata","take_action_tooltip":"Raggiungi la soglia di segnalazioni immediatamente, piuttosto che aspettare altre segnalazioni della comunità","cant":"Spiacenti, al momento non puoi segnalare questo messaggio.","notify_staff":"Notifica staff privatamente","formatted_name":{"off_topic":"E' fuori tema","inappropriate":"È inappropriato","spam":"E' Spam"},"custom_placeholder_notify_user":"Sii dettagliato, costruttivo e sempre gentile.","custom_placeholder_notify_moderators":"Facci sapere esattamente cosa ti preoccupa, fornendo collegamenti pertinenti ed esempi ove possibile.","custom_message":{"at_least":{"one":"inserisci almeno %{count} carattere","other":"inserisci almeno {{count}} caratteri"},"more":{"one":"%{count} mancante...","other":"{{count}} mancanti..."},"left":{"one":"%{count} mancante","other":"{{count}} rimanenti..."}}},"flagging_topic":{"title":"Grazie per aiutarci a mantenere la nostra comunità civile!","action":"Segnala Argomento","notify_action":"Messaggio"},"topic_map":{"title":"Riassunto Argomento","participants_title":"Autori Assidui","links_title":"Collegamenti Di Successo","links_shown":"mostra altri collegamenti...","clicks":{"one":"%{count} click","other":"%{count} clic"}},"post_links":{"about":"espandi altri collegamenti per questo messaggio","title":{"one":"un altro","other":"altri %{count}"}},"topic_statuses":{"warning":{"help":"Questo è un avvertimento ufficiale."},"bookmarked":{"help":"Hai aggiunto questo argomento ai segnalibri"},"locked":{"help":"Questo argomento è chiuso; non sono ammesse nuove risposte"},"archived":{"help":"Questo argomento è archiviato; è bloccato e non può essere modificato"},"locked_and_archived":{"help":"Questo argomento è chiuso e archiviato; non sono ammesse nuove risposte e non può essere modificato"},"unpinned":{"title":"Spuntato","help":"Questo argomento è per te spuntato; verrà mostrato con l'ordinamento di default"},"pinned_globally":{"title":"Appuntato Globalmente","help":"Questo argomento è appuntato globalmente; verrà mostrato sempre in cima sia agli argomenti recenti sia nella sua categoria."},"pinned":{"title":"Appuntato","help":"Questo argomento è per te appuntato; verrà mostrato con l'ordinamento di default"},"unlisted":{"help":"Questo argomento è invisibile; non verrà mostrato nella liste di argomenti ed è possibile accedervi solo tramite collegamento diretto"},"personal_message":{"title":"Questo argomento è un messaggio personale","help":"Questo argomento è un messaggio personale"}},"posts":"Messaggi","posts_long":"ci sono {{number}} messaggi in questo argomento","original_post":"Messaggio Originale","views":"Visite","views_lowercase":{"one":"visita","other":"visite"},"replies":"Risposte","views_long":{"one":"questo argomento è stato visto una volta","other":"questo argomento è stato visto {{number}} volte"},"activity":"Attività","likes":"Mi piace","likes_lowercase":{"one":"mi piace","other":"mi piace"},"likes_long":"ci sono {{number}} \"Mi piace\" in questo argomento","users":"Utenti","users_lowercase":{"one":"utente","other":"utenti"},"category_title":"Categoria","history":"Storia","changed_by":"da {{author}}","raw_email":{"title":"Email In Arrivo","not_available":"Non disponibile!"},"categories_list":"Lista Categorie","filters":{"with_topics":"%{filter} argomenti","with_category":"%{filter} %{category} argomenti","latest":{"title":"Recenti","title_with_count":{"one":"Recente (%{count})","other":"Recenti ({{count}})"},"help":"argomenti con messaggi recenti"},"read":{"title":"Letti","help":"argomenti che hai letto, in ordine di lettura"},"categories":{"title":"Categorie","title_in":"Categoria - {{categoryName}}","help":"tutti gli argomenti raggruppati per categoria"},"unread":{"title":"Non letti","title_with_count":{"one":"Non letto (%{count})","other":"Non letti ({{count}})"},"help":"argomenti che stai osservando o seguendo contenenti messaggi non letti","lower_title_with_count":{"one":"%{count} non letto","other":"{{count}} non letti"}},"new":{"lower_title_with_count":{"one":"%{count} nuovo","other":"{{count}} nuovi"},"lower_title":"nuovo","title":"Nuovi","title_with_count":{"one":"Nuovo (%{count})","other":"Nuovi ({{count}})"},"help":"argomenti creati negli ultimi giorni"},"posted":{"title":"I miei Messaggi","help":"argomenti in cui hai scritto"},"bookmarks":{"title":"Segnalibri","help":"argomenti che hai aggiunto ai segnalibri"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (%{count})","other":"{{categoryName}} ({{count}})"},"help":"argomenti recenti nella categoria {{categoryName}}"},"top":{"title":"Popolari","help":"gli argomenti più attivi nell'ultimo anno, mese, settimana o giorno","all":{"title":"Tutti"},"yearly":{"title":"Annuale"},"quarterly":{"title":"Trimestrale"},"monthly":{"title":"Mensile"},"weekly":{"title":"Settimanale"},"daily":{"title":"Giornaliero"},"all_time":"Tutti","this_year":"Anno","this_quarter":"Trimestre","this_month":"Mese","this_week":"Settimana","today":"Oggi","other_periods":"vedi argomenti di punta"},"votes":{"title":"Voti","help":"argomenti con il maggior numero di voti"}},"browser_update":"Sfortunatamente, \u003ca href=\"https://www.discourse.org/faq/#browser\"\u003eil tuo browser è troppo obsoleto per funzionare con questo sito\u003c/a\u003e. Per favore, \u003ca href=\"https://browsehappy.com\"\u003eaggiorna il tuo browser\u003c/a\u003e.","permission_types":{"full":"Crea / Rispondi / Visualizza","create_post":"Rispondi / Visualizza","readonly":"Visualizza"},"lightbox":{"download":"scarica","previous":"Precedente (tasto freccia a sinistra)","next":"Successivo (tasto freccia a destra)","counter":"%curr% di %total%","close":"Chiudi (Esc)","content_load_error":"Caricamento \u003ca href=\"%url%\"\u003edel contenuto\u003c/a\u003e non riuscito.","image_load_error":"Caricamento \u003ca href=\"%url%\"\u003edell'immagine\u003c/a\u003e non riuscito."},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":", ","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1} o %{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1} %{shortcut2}","title":"Scorciatoie Tastiera","jump_to":{"title":"Salta A","home":"%{shortcut} Home","latest":"%{shortcut} Recenti","new":"%{shortcut} Nuovi","unread":"%{shortcut} Non letti","categories":"%{shortcut} Categorie","top":"%{shortcut} Inizio","bookmarks":"%{shortcut} Segnalibri","profile":"%{shortcut} Profilo","messages":"%{shortcut} Messaggi","drafts":"%{shortcut} Bozze"},"navigation":{"title":"Navigazione","jump":"%{shortcut} Vai al messaggio n°","back":"%{shortcut} Indietro","up_down":"%{shortcut} Sposta la selezione \u0026uarr; \u0026darr;","open":"%{shortcut} Apri argomento selezionato","next_prev":"%{shortcut} Prossima/precedente sezione","go_to_unread_post":"%{shortcut} Vai al primo messaggio non letto"},"application":{"title":"Applicazione","create":"%{shortcut} Crea un nuovo argomento","notifications":"%{shortcut} Apri notifiche","hamburger_menu":"%{shortcut} Apri il menu hamburger","user_profile_menu":"%{shortcut} Apri menu utente","show_incoming_updated_topics":"%{shortcut} Mostra argomenti aggiornati","search":"%{shortcut} Cerca","help":"%{shortcut} Apri la legenda tasti","dismiss_new_posts":"%{shortcut} Marca i Nuovi messaggi come letti","dismiss_topics":"%{shortcut} Marca gli Argomenti come letti","log_out":"%{shortcut} Disconnetti"},"composing":{"title":"Scrittura","return":"%{shortcut} Ritorna al composer","fullscreen":"%{shortcut} Composer a tutto schermo"},"bookmarks":{"title":"Aggiungendo segnalibro","enter":"%{shortcut} Salva e chiudi","later_today":"%{shortcut}Più tardi oggi","later_this_week":"%{shortcut} Più tardi questa settimana","tomorrow":"%{shortcut} Domani","next_week":"%{shortcut}La prossima settimana ","next_month":"%{shortcut} Il prossimo mese","next_business_week":"%{shortcut} Inizio della prossima settimana","next_business_day":"%{shortcut} Il prossimo giorno lavorativo","custom":"%{shortcut} Data e ora personalizzate","none":"%{shortcut} Nessun promemoria"},"actions":{"title":"Azioni","bookmark_topic":"%{shortcut} Aggiungi/togli argomento nei segnalibri","pin_unpin_topic":"%{shortcut} Appunta/Spunta argomento","share_topic":"%{shortcut} Condividi argomento","share_post":"%{shortcut} Condividi messaggio","reply_as_new_topic":"%{shortcut} Rispondi come argomento collegato","reply_topic":"%{shortcut} Rispondi all'argomento","reply_post":"%{shortcut} Rispondi al messaggio","quote_post":"%{shortcut} Cita messaggio","like":"%{shortcut} Metti \"Mi piace\" al messaggio","flag":"%{shortcut} Segnala messaggio","bookmark":"%{shortcut} Aggiungi un segnalibro al messaggio","edit":"%{shortcut} Modifica messaggio","delete":"%{shortcut} Cancella messaggio","mark_muted":"%{shortcut} Silenzia argomento","mark_regular":"%{shortcut} Argomento normale (default)","mark_tracking":"%{shortcut} Segui argomento","mark_watching":"%{shortcut} Osserva argomento","print":"%{shortcut} Stampa argomento","defer":"%{shortcut} Rinvia argomento","topic_admin_actions":"%{shortcut} Apri le azioni amministrative sull'argomento"},"search_menu":{"title":"Menu Cerca","prev_next":"%{shortcut} Sposta la selezione su e giù","insert_url":"%{shortcut} Inserisci la selezione nel compositore aperto"}},"badges":{"earned_n_times":{"one":"Guadagnato questo distintivo %{count} volta","other":"Guadagnato questo distintivo %{count} volte"},"granted_on":"Assegnata %{date}","others_count":"Altri utenti con questo distintivo (%{count})","title":"Distintivi","allow_title":"Puoi usare questo distintivo come qualifica","multiple_grant":"Puoi guadagnarlo più volte","badge_count":{"one":"%{count} Distintivo","other":"%{count} Distintivi"},"more_badges":{"one":"+%{count} altro","other":"+ altri %{count}"},"granted":{"one":"%{count} assegnato","other":"%{count} assegnati"},"select_badge_for_title":"Seleziona un distintivo da usare come tuo titolo","none":"(nessuno)","successfully_granted":"Distintivo %{badge} assegnato con successo a %{username}","badge_grouping":{"getting_started":{"name":"Iniziali"},"community":{"name":"Comunità"},"trust_level":{"name":"Livello Esperienza"},"other":{"name":"Altri"},"posting":{"name":"Pubblicazione"}}},"tagging":{"all_tags":"Etichette","other_tags":"Altre Etichette","selector_all_tags":"tutte le etichette","selector_no_tags":"nessuna etichetta","changed":"etichette cambiate:","tags":"Etichette","choose_for_topic":"etichette facoltative","info":"Info","default_info":"Questa etichetta non è limitata a nessuna categoria e non ha sinonimi.","category_restricted":"Questa etichetta è limitata a categorie a cui non sei autorizzato ad accedere.","synonyms":"Sinonimi","synonyms_description":"Quando vengono utilizzate le seguenti etichette, verranno sostituite con \u003cb\u003e%{base_tag_name}\u003c/b\u003e.","tag_groups_info":{"one":"Questa etichetta appartiene al gruppo \"{{tag_groups}}\".","other":"Questa etichetta appartiene a questi gruppi: {{tag_groups}}."},"category_restrictions":{"one":"Può essere utilizzato solo in questa categoria:","other":"Può essere utilizzato solo in queste categorie:"},"edit_synonyms":"Gestisci sinonimi","add_synonyms_label":"Aggiungi sinonimi:","add_synonyms":"Aggiungi","add_synonyms_explanation":{"one":"Qualsiasi posto che attualmente utilizza questa etichetta verrà modificato per utilizzare invece \u003cb\u003e%{tag_name}\u003c/b\u003e. Sei sicuro di voler apportare questa modifica?","other":"Qualsiasi posto che attualmente utilizza queste etichette verrà modificato per utilizzare invece \u003cb\u003e%{tag_name}\u003c/b\u003e. Sei sicuro di voler apportare questa modifica?"},"add_synonyms_failed":"Le seguenti etichette non possono essere aggiunte come sinonimi: \u003cb\u003e%{tag_names}\u003c/b\u003e. Assicurati che non abbiano sinonimi e non siano sinonimi di un'altra etichetta.","remove_synonym":"Rimuovi sinonimo","delete_synonym_confirm":"Sei sicuro di voler eliminare il sinonimo \u0026quot;%{tag_name}\u0026quot;?","delete_tag":"Cancella Etichetta","delete_confirm":{"one":"Sei sicuro di voler eliminare questa etichetta e rimuoverla da %{count} argomento a cui è assegnata?","other":"Sei sicuro di voler eliminare questa etichetta e rimuoverla da {{count}} argomenti a cui è assegnata?"},"delete_confirm_no_topics":"Sei sicuro di voler eliminare questa etichetta?","delete_confirm_synonyms":{"one":"Anche il suo sinonimo verrà eliminato.","other":"I {{count}} sinonimi verranno a loro volta eliminati."},"rename_tag":"Rinomina Etichetta","rename_instructions":"Scegli un altro nome per l'etichetta:","sort_by":"Ordina per:","sort_by_count":"conteggio","sort_by_name":"nome","manage_groups":"Gestisci Gruppi Etichette","manage_groups_description":"Definisci gruppi per organizzare le etichette","upload":"Carica Etichette","upload_description":"Carica un file csv per creare Etichette in massa","upload_instructions":"Uno per riga, indicando opzionalmente un Gruppo di Etichette con il formato 'nome_etichetta,gruppo_etichetta'","upload_successful":"Etichette caricate con successo","delete_unused_confirmation":{"one":"%{count} Etichetta sarà eliminata: %{tags}","other":"%{count} etichette saranno eliminate: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} e %{count} altra","other":"%{tags} e %{count} altre"},"delete_unused":"Elimina Etichette Inutilizzate","delete_unused_description":"Elimina tutte le etichette che non sono usate in alcun argomento o messaggio personale","cancel_delete_unused":"Annulla","filters":{"without_category":"%{filter} %{tag} argomenti","with_category":"%{filter} %{tag} argomenti in %{category}","untagged_without_category":"%{filter} argomenti non etichettati","untagged_with_category":"%{filter} argomenti non etichettati in %{category}"},"notifications":{"watching":{"title":"In osservazione","description":"Visualizzerai automaticamente tutti gli Argomenti con questa Etichetta. Riceverai una notifica per tutti i nuovi messaggi e Argomenti. Inoltre, accanto all'Argomento apparirà il conteggio dei messaggi non letti e di quelli nuovi."},"watching_first_post":{"title":"Osservando Primo Messaggio","description":"Riceverai una notifica se saranno aperti nuovi Argomenti in questa Etichetta, ma non per le risposte agli Argomenti."},"tracking":{"title":"Seguiti","description":"Seguirai automaticamente tutti gli argomenti con questa Etichetta. Accanto all'argomento apparirà un conteggio dei messaggi non letti e di quelli nuovi."},"regular":{"title":"Normale","description":"Riceverai una notifica se qualcuno menziona il tuo @nome o risponde al tuo messaggio."},"muted":{"title":"Silenziato","description":"Non riceverai alcuna notifica per nuovi Argomenti con questa Etichetta, e non compariranno nella pagina dei messaggi non letti."}},"groups":{"title":"Gruppi Etichette","about":"Aggiungi etichette a gruppi per poterle gestire più facilmente.","new":"Nuovo Gruppo","tags_label":"Etichette in questo gruppo:","tags_placeholder":"etichette","parent_tag_label":"Etichetta padre:","parent_tag_placeholder":"Opzionale","parent_tag_description":"Le etichette di questo gruppo non possono essere usate finché è presente l'etichetta padre.","one_per_topic_label":"Limita ad una sola etichetta per argomento in questo gruppo","new_name":"Nuovo Gruppo Etichette","name_placeholder":"Nome Gruppo Etichette","save":"Salva","delete":"Elimina","confirm_delete":"Sicuro di voler cancellare questo gruppo di etichette?","everyone_can_use":"Le etichette possono essere usate da tutti","usable_only_by_staff":"Le etichette sono visibili a tutti, ma solo lo staff può usarle","visible_only_to_staff":"Le etichette sono visibili solo allo staff"},"topics":{"none":{"unread":"Non hai argomenti non letti.","new":"Non hai nuovi argomenti.","read":"Non hai ancora letto nessun argomento.","posted":"Non hai ancora scritto in nessun argomento.","latest":"Non ci sono argomenti più recenti.","bookmarks":"Non hai ancora argomenti nei segnalibri.","top":"Non ci sono argomenti popolari."},"bottom":{"latest":"Non ci sono ulteriori argomenti più recenti.","posted":"Non ci sono ulteriori argomenti inseriti.","read":"Non ci sono ulteriori argomenti letti.","new":"Non ci sono ulteriori nuovi argomenti.","unread":"Non ci sono ulteriori argomenti non letti.","top":"Non ci sono ulteriori argomenti popolari.","bookmarks":"Non ci sono ulteriori argomenti nei segnalibri."}}},"invite":{"custom_message":"Rendi il tuo invito un po' più personale scrivendo un \u003ca href\u003emessaggio personalizzato\u003c/a\u003e.","custom_message_placeholder":"Inserisci il tuo messaggio personalizzato","custom_message_template_forum":"Ehi, unisciti a questo forum!","custom_message_template_topic":"Ehi, credo che questo argomento ti possa interessare!"},"forced_anonymous":"A causa del carico eccessivo, il sito viene ora mostrato a tutti come lo vedrebbe un utente non connesso.","safe_mode":{"enabled":"La modalità sicura è attiva, per disattivarla chiudi il browser"},"poll":{"voters":{"one":"votante","other":"votanti"},"total_votes":{"one":"voto totale","other":"voti totali"},"average_rating":"Voto medio: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"I voti sono \u003cstrong\u003epubblici\u003c/strong\u003e."},"results":{"groups":{"title":"Devi essere un membro di %{groups} per votare in questo sondaggio."},"vote":{"title":"I risultati saranno mostrati al momento del \u003cstrong\u003evoto\u003c/strong\u003e."},"closed":{"title":"I risultati saranno mostrati a sondaggio \u003cstrong\u003echiuso\u003c/strong\u003e."},"staff":{"title":"I risultati saranno mostrati solo ai membri dello \u003cstrong\u003estaff\u003c/strong\u003e"}},"multiple":{"help":{"at_least_min_options":{"one":"Scegli almeno \u003cstrong\u003e%{count}\u003c/strong\u003e opzione","other":"Scegli almeno \u003cstrong\u003e%{count}\u003c/strong\u003e opzioni"},"up_to_max_options":{"one":"Scegli fino a \u003cstrong\u003e%{count}\u003c/strong\u003e opzione","other":"Scegli fino a \u003cstrong\u003e%{count}\u003c/strong\u003e opzioni"},"x_options":{"one":"Scegli \u003cstrong\u003e%{count}\u003c/strong\u003e opzione","other":"Scegli \u003cstrong\u003e%{count}\u003c/strong\u003e opzioni"},"between_min_and_max_options":"Scegli tra \u003cstrong\u003e%{min}\u003c/strong\u003e e \u003cstrong\u003e%{max}\u003c/strong\u003e opzioni"}},"cast-votes":{"title":"Vota","label":"Vota!"},"show-results":{"title":"Visualizza i risultati del sondaggio","label":"Mostra i risultati"},"hide-results":{"title":"Torna ai tuoi voti","label":"Mostra voto"},"group-results":{"title":"Voti raggruppati per campo utente","label":"Mostra la suddivisione"},"ungroup-results":{"title":"Combina tutti i voti","label":"Nascondi la suddivisione"},"export-results":{"title":"Esporta i risultati del sondaggio","label":"Esportare"},"open":{"title":"Apri il sondaggio","label":"Apri","confirm":"Sicuro di voler aprire questo sondaggio?"},"close":{"title":"Chiudi il sondaggio","label":"Chiudi","confirm":"Sicuro di voler chiudere questo sondaggio?"},"automatic_close":{"closes_in":"Chiude in \u003cstrong\u003e%{timeLeft}\u003c/strong\u003e.","age":"Chiuso \u003cstrong\u003e%{age}\u003c/strong\u003e"},"error_while_toggling_status":"Spiacenti, si è verificato un errore nel commutare lo stato di questo sondaggio.","error_while_casting_votes":"Spiacenti, si è verificato un errore nella votazione.","error_while_fetching_voters":"Spiacenti, si è verificato un errore nel visualizzare i votanti.","error_while_exporting_results":"Spiacenti, si è verificato un errore durante l'esportazione dei risultati del sondaggio.","ui_builder":{"title":"Crea Sondaggio","insert":"Inserisci Sondaggio","help":{"options_count":"Inserisci almeno 1 opzione","invalid_values":"Il valore minimo deve essere minore del valore massimo.","min_step_value":"Il valore minimo di un passo è 1"},"poll_type":{"label":"Tipo","regular":"Scelta Singola","multiple":"Scelta Multipla","number":"Votazione Numerica"},"poll_result":{"label":"Risultati","always":"Sempre visibile","vote":"Al momento del voto","closed":"Quando chiuso","staff":"Solo staff"},"poll_groups":{"label":"Gruppi ammessi"},"poll_chart_type":{"label":"Tipo di grafico"},"poll_config":{"max":"Massimo","min":"Minimo","step":"Passo"},"poll_public":{"label":"Mostra i votanti"},"poll_options":{"label":"Inserisci un'opzione di sondaggio per riga"},"automatic_close":{"label":"Chiudi sondaggio automaticamente"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Avviare il tutorial nuovo utente per tutti i nuovi utenti","welcome_message":"Inviare a tutti i nuovi utenti un messaggio di benvenuto con una guida di avvio rapido"}},"discourse_local_dates":{"relative_dates":{"today":"Oggi %{time}","tomorrow":"Domani %{time}","yesterday":"Ieri %{time}","countdown":{"passed":"la data è passata"}},"title":"Inserisci data / ora","create":{"form":{"insert":"Inserisci","advanced_mode":"Modalità avanzata","simple_mode":"Modalità semplice","format_description":"Formato usato per mostrare la data all'utente. Usa \"\\T\\Z\" per visualizzare il fuso orario per esteso (Europe/Paris)","timezones_title":"Fusi orari da visualizzare","timezones_description":"I fusi orari verranno utilizzati per visualizzare le date nell'anteprima e nel fallback.","recurring_title":"Ricorrenza","recurring_description":"Definisci la ricorrenza di un evento. Puoi anche modificare manualmente l'opzione di ricorrenza generata dal modulo e usare una delle seguenti chiavi: anni, trimestri, mesi, settimane, giorni, ore, minuti, secondi, millisecondi.","recurring_none":"Nessuna ricorrenza","invalid_date":"Data non valida, accertati che la data e l'ora siano corrette","date_title":"Data","time_title":"Ora","format_title":"Formato data","timezone":"Fuso orario","until":"Fino a...","recurring":{"every_day":"Ogni giorno","every_week":"Ogni settimana","every_two_weeks":"Ogni due settimane","every_month":"Ogni mese","every_two_months":"Ogni due mesi","every_three_months":"Ogni tre mesi","every_six_months":"Ogni sei mesi","every_year":"Ogni anno"}}}},"details":{"title":"Nascondi Dettagli"},"presence":{"replying":"sta rispondendo","editing":"modificando","replying_to_topic":{"one":"sta rispondendo","other":"stanno rispondendo"}},"voting":{"title":"Votare","reached_limit":"Hai terminato i voti, rimuovi un voto esistente!","list_votes":"Elenca i tuoi voti","votes_nav_help":"argomenti con il maggior numero di voti","voted":"Hai votato su questo argomento","allow_topic_voting":"Permetti agli utenti di votare argomenti in questa categoria","vote_title":"Vota","vote_title_plural":"Voti","voted_title":"Votato","voting_closed_title":"Chiuso","voting_limit":"Limite","votes_left":{"one":"Ti resta {{count}} voto, guarda \u003ca href='{{path}}'\u003ei tuoi voti\u003c/a\u003e.","other":"Ti restano {{count}}voti, guarda \u003ca href='{{path}}'\u003ei tuoi voti\u003c/a\u003e."},"votes":{"one":"{{count}}voto","other":"{{count}}voti"},"anonymous_button":{"one":"Voto","other":"Voti"},"remove_vote":"Rimuovi voto"},"adplugin":{"advertisement_label":"ANNUNCIO"},"docker":{"upgrade":"La tua installazione Discourse è obsoleta.","perform_upgrade":"Clicca qui per aggiornare."}}},"zh_CN":{"js":{"bookmarks":{"delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。"},"keyboard_shortcuts_help":{"bookmarks":{"delete":"%{shortcut} 删除收藏"}}}},"en":{"js":{"local_time":"Local Time","discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'it';
I18n.pluralizationRules.it = MessageFormat.locale.it;
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


    var it = moment.defineLocale('it', {
        months : 'gennaio_febbraio_marzo_aprile_maggio_giugno_luglio_agosto_settembre_ottobre_novembre_dicembre'.split('_'),
        monthsShort : 'gen_feb_mar_apr_mag_giu_lug_ago_set_ott_nov_dic'.split('_'),
        weekdays : 'domenica_lunedì_martedì_mercoledì_giovedì_venerdì_sabato'.split('_'),
        weekdaysShort : 'dom_lun_mar_mer_gio_ven_sab'.split('_'),
        weekdaysMin : 'do_lu_ma_me_gi_ve_sa'.split('_'),
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY HH:mm',
            LLLL : 'dddd D MMMM YYYY HH:mm'
        },
        calendar : {
            sameDay: '[Oggi alle] LT',
            nextDay: '[Domani alle] LT',
            nextWeek: 'dddd [alle] LT',
            lastDay: '[Ieri alle] LT',
            lastWeek: function () {
                switch (this.day()) {
                    case 0:
                        return '[la scorsa] dddd [alle] LT';
                    default:
                        return '[lo scorso] dddd [alle] LT';
                }
            },
            sameElse: 'L'
        },
        relativeTime : {
            future : function (s) {
                return ((/^[0-9].+$/).test(s) ? 'tra' : 'in') + ' ' + s;
            },
            past : '%s fa',
            s : 'alcuni secondi',
            ss : '%d secondi',
            m : 'un minuto',
            mm : '%d minuti',
            h : 'un\'ora',
            hh : '%d ore',
            d : 'un giorno',
            dd : '%d giorni',
            M : 'un mese',
            MM : '%d mesi',
            y : 'un anno',
            yy : '%d anni'
        },
        dayOfMonthOrdinalParse : /\d{1,2}º/,
        ordinal: '%dº',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return it;

})));

// moment-timezone-localization for lang code: it

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Abidjan","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Accra","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Addis Abeba","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Algeri","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Asmara","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Bamako","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Bangui","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Banjul","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Bissau","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Blantyre","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Brazzaville","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Bujumbura","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"Il Cairo","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Casablanca","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"Ceuta","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"Conakry","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Dakar","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Dar es Salaam","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Gibuti","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Douala","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"El Ayun","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Freetown","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Gaborone","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Harare","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Johannesburg","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Giuba","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Kampala","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Khartum","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Kigali","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Kinshasa","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Lagos","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Libreville","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Lomé","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Luanda","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Lubumbashi","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Lusaka","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Malabo","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Maputo","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Maseru","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Mbabane","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Mogadiscio","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Monrovia","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Nairobi","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"N’Djamena","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Niamey","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Nouakchott","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Ouagadougou","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Porto-Novo","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"São Tomé","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Tripoli","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Tunisi","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Windhoek","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Adak","id":"America/Adak"},{"value":"America/Anchorage","name":"Anchorage","id":"America/Anchorage"},{"value":"America/Anguilla","name":"Anguilla","id":"America/Anguilla"},{"value":"America/Antigua","name":"Antigua","id":"America/Antigua"},{"value":"America/Araguaina","name":"Araguaina","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"La Rioja","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Rio Gallegos","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Salta","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"San Juan","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"San Luis","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Tucumán","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ushuaia","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Aruba","id":"America/Aruba"},{"value":"America/Asuncion","name":"Asunción","id":"America/Asuncion"},{"value":"America/Bahia","name":"Bahia","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Bahía de Banderas","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"Barbados","id":"America/Barbados"},{"value":"America/Belem","name":"Belem","id":"America/Belem"},{"value":"America/Belize","name":"Belize","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Blanc-Sablon","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Boa Vista","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Bogotá","id":"America/Bogota"},{"value":"America/Boise","name":"Boise","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Buenos Aires","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Cambridge Bay","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Campo Grande","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Cancún","id":"America/Cancun"},{"value":"America/Caracas","name":"Caracas","id":"America/Caracas"},{"value":"America/Catamarca","name":"Catamarca","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Caienna","id":"America/Cayenne"},{"value":"America/Cayman","name":"Cayman","id":"America/Cayman"},{"value":"America/Chicago","name":"Chicago","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Chihuahua","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Atikokan","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Cordoba","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Costa Rica","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Creston","id":"America/Creston"},{"value":"America/Cuiaba","name":"Cuiaba","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Curaçao","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Danmarkshavn","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Dawson","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Dawson Creek","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Denver","id":"America/Denver"},{"value":"America/Detroit","name":"Detroit","id":"America/Detroit"},{"value":"America/Dominica","name":"Dominica","id":"America/Dominica"},{"value":"America/Edmonton","name":"Edmonton","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Eirunepe","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"El Salvador","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Fort Nelson","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Fortaleza","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Glace Bay","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"Nuuk","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Goose Bay","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Grand Turk","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Grenada","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Guadalupa","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Guatemala","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Guayaquil","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Guyana","id":"America/Guyana"},{"value":"America/Halifax","name":"Halifax","id":"America/Halifax"},{"value":"America/Havana","name":"L’Avana","id":"America/Havana"},{"value":"America/Hermosillo","name":"Hermosillo","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Knox, Indiana","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Marengo, Indiana","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Petersburg, Indiana","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Tell City, Indiana","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Vevay, Indiana","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Vincennes, Indiana","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Winamac, Indiana","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Indianapolis","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Inuvik","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Iqaluit","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Giamaica","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Jujuy","id":"America/Jujuy"},{"value":"America/Juneau","name":"Juneau","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Monticello, Kentucky","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Kralendijk","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"La Paz","id":"America/La_Paz"},{"value":"America/Lima","name":"Lima","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Los Angeles","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Louisville","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Lower Prince’s Quarter","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Maceio","id":"America/Maceio"},{"value":"America/Managua","name":"Managua","id":"America/Managua"},{"value":"America/Manaus","name":"Manaus","id":"America/Manaus"},{"value":"America/Marigot","name":"Marigot","id":"America/Marigot"},{"value":"America/Martinique","name":"Martinica","id":"America/Martinique"},{"value":"America/Matamoros","name":"Matamoros","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Mazatlan","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Mendoza","id":"America/Mendoza"},{"value":"America/Menominee","name":"Menominee","id":"America/Menominee"},{"value":"America/Merida","name":"Mérida","id":"America/Merida"},{"value":"America/Metlakatla","name":"Metlakatla","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Città del Messico","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Miquelon","id":"America/Miquelon"},{"value":"America/Moncton","name":"Moncton","id":"America/Moncton"},{"value":"America/Monterrey","name":"Monterrey","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Montevideo","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Montserrat","id":"America/Montserrat"},{"value":"America/Nassau","name":"Nassau","id":"America/Nassau"},{"value":"America/New_York","name":"New York","id":"America/New_York"},{"value":"America/Nipigon","name":"Nipigon","id":"America/Nipigon"},{"value":"America/Nome","name":"Nome","id":"America/Nome"},{"value":"America/Noronha","name":"Noronha","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Beulah, Dakota del nord","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Center, Dakota del nord","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"New Salem, Dakota del nord","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Ojinaga","id":"America/Ojinaga"},{"value":"America/Panama","name":"Panamá","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Pangnirtung","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Paramaribo","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Phoenix","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Port-au-Prince","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Port of Spain","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Porto Velho","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Portorico","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Punta Arenas","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Rainy River","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Rankin Inlet","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Recife","id":"America/Recife"},{"value":"America/Regina","name":"Regina","id":"America/Regina"},{"value":"America/Resolute","name":"Resolute","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Rio Branco","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Santa Isabel","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Santarém","id":"America/Santarem"},{"value":"America/Santiago","name":"Santiago","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Santo Domingo","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"San Paolo","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"Ittoqqortoormiit","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Sitka","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"Saint-Barthélemy","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"St. John’s","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"St. Kitts","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"Santa Lucia","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"Saint Thomas","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"Saint Vincent","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"Swift Current","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Tegucigalpa","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"Thule","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Thunder Bay","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Tijuana","id":"America/Tijuana"},{"value":"America/Toronto","name":"Toronto","id":"America/Toronto"},{"value":"America/Tortola","name":"Tortola","id":"America/Tortola"},{"value":"America/Vancouver","name":"Vancouver","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Whitehorse","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Winnipeg","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Yakutat","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Yellowknife","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"Casey","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"Davis","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"Dumont d’Urville","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"Macquarie","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"Mawson","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"McMurdo","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"Palmer","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"Rothera","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"Syowa","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"Troll","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"Vostok","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"Longyearbyen","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"Aden","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"Almaty","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"Amman","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"Anadyr’","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"Aqtau","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"Aqtöbe","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Ashgabat","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"Atyrau","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"Baghdad","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Bahrein","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"Baku","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"Bangkok","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"Barnaul","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"Beirut","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"Bishkek","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"Brunei","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"Calcutta","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"Čita","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"Choibalsan","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"Colombo","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"Damasco","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Dacca","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"Dili","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"Dubai","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"Dushanbe","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"Famagosta","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"Gaza","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"Hebron","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"Hong Kong","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"Hovd","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"Irkutsk","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"Giacarta","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"Jayapura","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"Gerusalemme","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"Kabul","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"Kamchatka","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"Karachi","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Kathmandu","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"Chandyga","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"Krasnojarsk","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"Kuala Lumpur","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"Kuching","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"Kuwait","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"Macao","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"Magadan","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"Makassar","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"Manila","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"Mascate","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Nicosia","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"Novokuzneck","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"Novosibirsk","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"Omsk","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"Oral","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"Phnom Penh","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"Pontianak","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"Pyongyang","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"Qatar","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"Qyzylorda","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"Rangoon","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"Riyad","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"Ho Chi Minh","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"Sachalin","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Samarcanda","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Seul","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Shanghai","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Singapore","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"Srednekolymsk","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"Taipei","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"Tashkent","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"Tbilisi","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"Teheran","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Thimphu","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Tokyo","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"Tomsk","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"Ulaanbaatar","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"Urumqi","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"Ust’-Nera","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"Vientiane","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"Vladivostok","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"Jakutsk","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"Ekaterinburg","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"Yerevan","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"Azzorre","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Bermuda","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"Canarie","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Capo Verde","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Isole Fær Øer","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Madeira","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Reykjavík","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"Georgia del Sud","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"Sant’Elena","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Stanley","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"Adelaide","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"Brisbane","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"Broken Hill","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"Currie","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"Darwin","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"Eucla","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"Hobart","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"Lindeman","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"Lord Howe","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"Melbourne","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"Perth","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"Sydney","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"Tempo coordinato universale","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Amsterdam","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"Andorra","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"Astrakhan","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Atene","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Belgrado","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Berlino","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"Bratislava","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"Bruxelles","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Bucarest","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Budapest","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Büsingen","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"Chisinau","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"Copenaghen","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"Ora legale dell’IrlandaDublino","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Gibilterra","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Guernsey","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Helsinki","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"Isola di Man","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"Istanbul","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Jersey","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Kaliningrad","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Kiev","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"Kirov","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"Lisbona","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Lubiana","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"Ora legale del Regno UnitoLondra","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Lussemburgo","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Madrid","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Malta","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"Mariehamn","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"Minsk","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"Monaco","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Mosca","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Oslo","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"Parigi","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"Podgorica","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"Praga","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Riga","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Roma","id":"Europe/Rome"},{"value":"Europe/Samara","name":"Samara","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"San Marino","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"Sarajevo","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"Saratov","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"Sinferopoli","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"Skopje","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"Sofia","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Stoccolma","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"Tallinn","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"Tirana","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Ulyanovsk","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"Užhorod","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"Vaduz","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"Città del Vaticano","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Vienna","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"Vilnius","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"Volgograd","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Varsavia","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Zagabria","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Zaporozhye","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Zurigo","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Antananarivo","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"Chagos","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"Natale","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"Cocos","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"Comore","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"Kerguelen","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"Mahe","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Maldive","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Mauritius","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Mayotte","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"La Riunione","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Apia","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"Auckland","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"Bougainville","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"Chatham","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"Pasqua","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Efate","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"Enderbury","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"Fakaofo","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"Figi","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"Funafuti","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"Galapagos","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"Gambier","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"Guadalcanal","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"Guam","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"Honolulu","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"Johnston","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"Kiritimati","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"Kosrae","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"Kwajalein","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"Majuro","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"Marchesi","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"Midway","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"Nauru","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"Niue","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"Norfolk","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"Noumea","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"Pago Pago","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"Palau","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"Pitcairn","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"Pohnpei","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"Port Moresby","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"Rarotonga","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"Saipan","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"Tahiti","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Tarawa","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"Tongatapu","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"Chuuk","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"Wake","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"Wallis","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
