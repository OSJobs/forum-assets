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
I18n._compiledMFs = {"logs_error_rate_notice.reached_hour_MF" : function(){ return "Invalid Format: Error: No 'other' form found in pluralFormatPattern 0";}, "logs_error_rate_notice.reached_minute_MF" : function(){ return "Invalid Format: Error: No 'other' form found in pluralFormatPattern 0";}, "logs_error_rate_notice.exceeded_hour_MF" : function(){ return "Invalid Format: Error: No 'other' form found in pluralFormatPattern 0";}, "logs_error_rate_notice.exceeded_minute_MF" : function(){ return "Invalid Format: Error: No 'other' form found in pluralFormatPattern 0";}, "topic.read_more_MF" : function(d){
var r = "";
r += "Der ";
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
r += "er <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 ulæst</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "er <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " ulæste</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "is ";
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
r += "/new'>1 new</a> topic";
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
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "are ";
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
})() + " new</a> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " tilbage, eller ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "kig på andre emner i ";
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
r += "Du er ved at slette <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["posts"];
r += "</b> indlæg og ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> emne";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> emner";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " oprettet af denne bruger, fjerne deres konto, blokere tilmeldinger fra deres IP-adresse <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> og tilføje deres e-mail-adresse <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> til en permanent blokeringsliste. Er du sikker på, at denne bruger virkelig er en spammer?";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "Dette emne har ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 svar";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " svar";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "med et højt like pr. indlæg forhold";
return r;
},
"med" : function(d){
var r = "";
r += "med et meget højt like pr. indlæg forhold";
return r;
},
"high" : function(d){
var r = "";
r += "med et ekstremt højt like pr. indlæg forhold";
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
r += "Du er ved at slette ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 post";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " posts";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " og ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 topic";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Er du sikker?";
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
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["da"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "topic.bumped_at_title_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected [a-zA-Z$_] but \"%u9996\" found. at undefined:1376:10";}};
MessageFormat.locale.da = function ( n ) {
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

I18n.translations = {"da":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"HH:mm","time_with_zone":"HH:mm (z)","timeline_date":"MMM YYYY","long_no_year_no_time":"D. MMM","full_no_year_no_time":"D. MMMM","long_with_year":"D. MMM YYYY HH:mm","long_with_year_no_time":"D. MMM YYYY","full_with_year_no_time":"D. MMMM YYYY","long_date_with_year":"D. MMM 'YY, kl. LT","long_date_without_year":"D. MMM, kl. LT","long_date_with_year_without_time":"D. MMM 'YY","long_date_without_year_with_linebreak":"D. MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D. MMM 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} siden","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c %{count}s","other":"\u003c %{count}s"},"x_seconds":{"one":"%{count}s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u0026lt;%{count}m","other":"\u003c %{count}m"},"x_minutes":{"one":"%{count}m","other":"%{count}m"},"about_x_hours":{"one":"%{count}t","other":"%{count}h"},"x_days":{"one":"%{count}d","other":"%{count}d"},"x_months":{"one":"%{count}mon","other":"%{count}mdr"},"about_x_years":{"one":"%{count}å","other":"%{count}å"},"over_x_years":{"one":"\u003e %{count}å","other":"\u003e %{count}å"},"almost_x_years":{"one":"%{count}å","other":"%{count}å"},"date_month":"D. MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"%{count} min","other":"%{count} min"},"x_hours":{"one":"%{count} time","other":"%{count} timer"},"x_days":{"one":"%{count} dag","other":"%{count} dage"},"date_year":"D. MMM 'YY"},"medium_with_ago":{"x_minutes":{"one":"%{count} min siden","other":"%{count} min siden"},"x_hours":{"one":"%{count} time siden","other":"%{count} timer siden"},"x_days":{"one":"%{count} dag siden","other":"%{count} dage siden"},"x_months":{"one":"%{count} måned siden","other":"%{count} måneder siden"},"x_years":{"one":"%{count} år siden","other":"%{count} år siden"}},"later":{"x_days":{"one":"%{count} dag senere","other":"%{count} dage senere"},"x_months":{"one":"%{count} måned senere","other":"%{count} måneder senere"},"x_years":{"one":"%{count} år senere","other":"%{count} år senere"}},"previous_month":"Forrige måned","next_month":"Næste måned","placeholder":"dato"},"share":{"topic_html":"Emne: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"indlæg #%{postNumber}","close":"luk","twitter":"Del dette link  via Twitter","facebook":"Del dette link via Facebook","email":"Send dette link via email"},"action_codes":{"public_topic":"offentliggjorde dette emne %{when}","private_topic":"gjorde dette emne til en privat besked %{when}","split_topic":"delte dette emne op %{when}","invited_user":"Inviterede %{who} %{when}","invited_group":"inviterede %{who} %{when}","user_left":"%{who}fjernede sig selv fra denne besked %{when}","removed_user":"fjernede %{who} %{when}","removed_group":"fjernede %{who} %{when}","autobumped":"automatisk 'bumpet' %{when}","autoclosed":{"enabled":"lukket %{when}","disabled":"åbnet %{when}"},"closed":{"enabled":"lukket %{when}","disabled":"åbnet %{when}"},"archived":{"enabled":"arkiveret %{when}","disabled":" fjernet fra arkivet %{when}"},"pinned":{"enabled":"fastgjort %{when}","disabled":"frigjort %{when}"},"pinned_globally":{"enabled":"globalt fastgjort %{when}","disabled":"frigjort %{when}"},"visible":{"enabled":"listet %{when}","disabled":"aflistet %{when}"},"banner":{"enabled":"lavede dette til et banner %{when}. Emnet bliver vist på toppen af alle sider indtil det bliver afskediget af brugeren.","disabled":"fjernede banneret %{when}. Det vil ikke længere vises i toppen af alle sider."}},"wizard_required":"Velkommen til din nye Discourse! Lad os komme i gang med \u003ca href='%{url}' data-auto-route='true'\u003ekonfigurationsguiden\u003c/a\u003e ✨","emails_are_disabled":"Alle udgående emails er blevet globalt deaktiveret af en administrator. Ingen email notifikationer af nogen slags vil blive sendt.","bootstrap_mode_enabled":"For at gøre lanceringen af dit nye forum lettere er du i bootstrap-tilstand. Alle nye brugere tildeles tillidsniveau 1 og har dagligt email resume aktiveret. Dette deaktiveres automatisk, når %{min_users} brugere er tilsluttet.","bootstrap_mode_disabled":"Bootstrap-tilstand deaktiveres inden for 24 timer.","themes":{"default_description":"Standard","broken_theme_alert":"Dit websted fungerer muligvis ikke, fordi tema / komponent %{theme} har fejl. Deaktiver det her: %{path}."},"s3":{"regions":{"ap_northeast_1":"Asien (Tokyo)","ap_northeast_2":"Asien (Seoul)","ap_south_1":"Asien (Mumbai)","ap_southeast_1":"Asien (Singapore)","ap_southeast_2":"Asien (Sydney)","ca_central_1":"Canada (Central)","cn_north_1":"Kina (Beijing)","cn_northwest_1":"Kina (Ninghsia)","eu_central_1":"EU (Frankfurt)","eu_north_1":"EU (Stockholm)","eu_west_1":"EU (Irland)","eu_west_2":"EU (London)","eu_west_3":"EU (Paris)","sa_east_1":"Syd Amerika (São Paulo)","us_east_1":"US East (N. Virginia)","us_east_2":"US East (Ohio)","us_gov_east_1":"AWS GovCloud (US-East)","us_gov_west_1":"AWS GovCloud (US-West)","us_west_1":"US West (N. California)","us_west_2":"US West (Oregon)"}},"edit":"redigér titel og kategori for dette emne","expand":"Udvid","not_implemented":"Beklager! Denne feature er ikke blevet implementeret endnu.","no_value":"Nej","yes_value":"Ja","submit":"Færdiggør","generic_error":"Beklager, der opstod en fejl.","generic_error_with_reason":"Der opstod en fejl: %{error}","go_ahead":"Fortsæt","sign_up":"Tilmeld","log_in":"Log ind","age":"Alder","joined":"Tilmeldt","admin_title":"Admin","show_more":"vis mere","show_help":"indstillinger","links":"Links","links_lowercase":{"one":"link","other":"links"},"faq":"FAQ","guidelines":"Retningslinier","privacy_policy":"Privatlivspolitik","privacy":"Privatliv","tos":"Servicevilkår","rules":"Regler","conduct":"Retningslinjer","mobile_view":"Vis på mobil","desktop_view":"Vis på computer","you":"Dig","or":"eller","now":"lige sket","read_more":"læs mere","more":"Mere","less":"Mindre","never":"aldrig","every_30_minutes":"hver halve time","every_hour":"hver time","daily":"dagligt","weekly":"ugentligt","every_month":"hver måned","every_six_months":"hvert halvår","max_of_count":"maks af {{count}}","alternation":"eller","character_count":{"one":"{{count}} tegn","other":"{{count}} tegn"},"related_messages":{"title":"Relaterede beskeder","see_all":"Se \u003ca href=\"%{path}\"\u003ealle beskeder\u003c/a\u003e fra @ %{username} ..."},"suggested_topics":{"title":"Foreslåede emner","pm_title":"Foreslåede beskeder"},"about":{"simple_title":"Om","title":"Om %{title}","stats":"Hjemmeside statistikker","our_admins":"Vores Administratorer","our_moderators":"Vores Moderatorer","moderators":"Moderatorer","stat":{"all_time":"Altid","last_7_days":"Seneste 7","last_30_days":"Seneste 30"},"like_count":"Synes godt om","topic_count":"Emner","post_count":"Indlæg","user_count":"Brugere","active_user_count":"Aktive brugere","contact":"Kontakt os","contact_info":"I tilfælde af en kritisk begivenhed eller vigtige spørgsmål angående denne side, kontakt os venligst på %{contact_info}."},"bookmarked":{"title":"Bogmærke","clear_bookmarks":"Fjern bogmærker","help":{"bookmark":"Klik for at sætte et bogmærke i det første indlæg i denne tråd","unbookmark":"Klik for at fjerne alle bogmærker i dette emne"}},"bookmarks":{"created":"du har bogmærket dette indlæg.","not_bookmarked":"bogmærke dette indlæg","remove":"Fjern bogmærke","confirm_clear":"Er du sikker på, at du vil rydde alle dine bogmærker fra dette emne?","save":"Gem","reminders":{"later_today":"Senere i dag","tomorrow":"I morgen","next_week":"Næste uge","later_this_week":"Senere på ugen","next_month":"Næste Månede","custom":"Valgfri dato og tid"}},"drafts":{"resume":"Genoptag","remove":"Fjern","new_topic":"Nyt emne-kladde","new_private_message":"Ny kladde til privat besked","topic_reply":"Udkast svar","abandon":{"confirm":"Du har allerede åbnet et andet udkast til dette emne. Er du sikker på, at du vil opgive det?","yes_value":"Ja, opgiv","no_value":"Nej, behold"}},"topic_count_latest":{"one":"Se {{count}} nyt eller opdateret emne","other":"Se {{count}} nye eller opdaterede emner"},"topic_count_unread":{"one":"Se {{count}} ulæst emne","other":"Se {{count}} ulæste emner"},"topic_count_new":{"one":"Se {{count}} nyt emne","other":"Se {{count}} nye emner"},"preview":"forhåndsvising","cancel":"annullér","save":"Gem ændringer","saving":"Gemmer…","saved":"Gemt!","upload":"Upload","uploading":"Uploader…","uploading_filename":"Uploader: {{filename}} ...","clipboard":"udklipsholder","uploaded":"Uploadet!","pasting":"Indsætter...","enable":"Aktivér","disable":"Deaktivér","continue":"Fortsæt","undo":"Fortryd","revert":"Gendan","failed":"Fejlet","switch_to_anon":"Gå i anonym tilstand","switch_from_anon":"Afslut anonym tilstand","banner":{"close":"Afvis dette banner.","edit":"Rediger dette banner \u003e\u003e"},"choose_topic":{"none_found":"Ingen emner fundet.","title":{"search":"Søg efter et emne","placeholder":"indtast emnets titel, url eller id her"}},"choose_message":{"none_found":"Ingen beskeder fundet.","title":{"search":"Søg efter en besked","placeholder":"indtaste beskeds titel, url eller id her"}},"review":{"order_by":"Filtrér efter","in_reply_to":"som svar til","explain":{"why":"forklar hvorfor dette punkt endte i køen","title":"Gennemgåelig Scoring","formula":"Formular","subtotal":"Subtotal","total":"Total","min_score_visibility":"Minimum score for synlighed","score_to_hide":"Score for 'skjul indlæg'","take_action_bonus":{"name":"tog handling","title":"Når et personale medlem vælger at tage handling, får denne markering en bonus"},"user_accuracy_bonus":{"name":"bruger nøjagtighed","title":"Brugere, hvis markeringer er historisk aftalt med, får en bonus."},"trust_level_bonus":{"name":"tillidsniveau","title":"Punkter, der kan gennemgås som er oprettet af brugere af højere tillidsniveau, har en højere score."},"type_bonus":{"name":"type bonus","title":"Visse gennemgåelige typer kan tildeles en bonus af personale medlemmer, for at gøre dem til en højere prioritet."}},"claim_help":{"optional":"Du kan gøre krav på dette punkt, for at forhindre andre i at gennemgå det.","required":"Du skal kræve punkter, før du kan gennemgå dem.","claimed_by_you":"Du har gjort krav på dette punkt og kan gennemgå det.","claimed_by_other":"Dette punkt kan kun gennemgås af \u003cb\u003e{{username}}\u003c/b\u003e ."},"claim":{"title":"gør krav på dette emne"},"unclaim":{"help":"fjern dette krav"},"awaiting_approval":"Afventer godkendelse","delete":"Slet","settings":{"saved":"Gemt","save_changes":"Gem ændringer","title":"Indstillinger","priorities":{"title":"Prioriteter, der kan gennemgås"}},"moderation_history":"Moderationshistorik","view_all":"Se alle","grouped_by_topic":"Grupperet efter emne","none":"Der er ingen punkter at gennemgå.","view_pending":"vis afventende","topic_has_pending":{"one":"Dette emne har \u003cb\u003e%{count}\u003c/b\u003e indlæg, afventende godkendelse","other":"Dette emne har \u003cb\u003e{{count}}\u003c/b\u003e indlæg, afventende godkendelse"},"title":"Anmeldelse","topic":"Emne:","filtered_topic":"Du har filtreret til indhold der kan andmeldes i ét enkelt emne.","filtered_user":"Bruger","show_all_topics":"vis alle emner","deleted_post":"(indlæg slettet)","deleted_user":"(bruger slettet)","user":{"username":"Brugernavn","email":"Email","name":"Navn","fields":"Felter"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} samlet markering)","other":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} samlede markeringer)"},"agreed":{"one":"{{count}}% er enige","other":"{{count}}% er enige"},"disagreed":{"one":"{{count}}% er uenig","other":"{{count}}% er uenige"},"ignored":{"one":"{{count}}% ignorerer","other":"{{count}}% ignorerer"}},"topics":{"topic":"Emne","reviewable_count":"Tælle","reported_by":"Rapporteret af","deleted":"[Emne slettet]","original":"(originalt emne)","details":"detaljer","unique_users":{"one":"%{count} bruger","other":"{{count}} brugere"}},"replies":{"one":"%{count} svar","other":"{{count}} svar"},"edit":"Rediger","save":"Gem","cancel":"Afbryd","new_topic":"Godkendelse af dette punkt opretter et nyt emne","filters":{"all_categories":"(alle kategorier)","type":{"title":"Type","all":"(alle typer)"},"minimum_score":"Minimum score:","refresh":"Opdatér","status":"Status","category":"Kategori","orders":{"priority":"Prioritet","priority_asc":"Prioritet (omvendt)","created_at":"Oprettet kl","created_at_asc":"Oprettet kl (omvendt)"},"priority":{"title":"Minimum prioritet","low":"(enhver)","medium":"Medium","high":"Høj"}},"conversation":{"view_full":"vis fuld samtale"},"scores":{"about":"Denne score beregnes på baggrund af reporterens tillidsniveau, nøjagtigheden af deres tidligere markeringer og prioriteten for punktet som rapporteres.","score":"Score","date":"Dato","type":"Type","status":"Status","submitted_by":"Indsendt af","reviewed_by":"Gennemgået Af"},"statuses":{"pending":{"title":"Afventende"},"approved":{"title":"Godkendt"},"rejected":{"title":"Afvist"},"ignored":{"title":"Ignoreret"},"deleted":{"title":"Slettet"},"reviewed":{"title":"(alle gennemgåede)"},"all":{"title":"(alting)"}},"types":{"reviewable_flagged_post":{"title":"Markeret indlæg","flagged_by":"Markeret af"},"reviewable_queued_topic":{"title":"Emne i kø"},"reviewable_queued_post":{"title":"Indlæg i kø"},"reviewable_user":{"title":"bruger"}},"approval":{"title":"Indlæg afventer godkendelse","description":"Vi har modtaget dit indlæg, men det skal først godkendes af en moderator. Hav venligst tålmodighed.","pending_posts":{"one":"Du har \u003cstrong\u003e%{count}\u003c/strong\u003e afventende indlæg.","other":"Du har \u003cstrong\u003e{{count}}\u003c/strong\u003e indlæg afventende."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e oprettede \u003ca href='{{topicUrl}}'\u003eemnet\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e oprettede \u003ca href='{{topicUrl}}'\u003eemnet\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e svarede på \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e svarede på \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e svarede på \u003ca href='{{topicUrl}}'\u003eemnet\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eDu\u003c/a\u003e svarede på \u003ca href='{{topicUrl}}'\u003eemnet\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e nævnte \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e nævnte \u003ca href='{{user2Url}}'\u003edig\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eDu\u003c/a\u003e nævnte \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Oprettet af \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Oprettet af \u003ca href='{{userUrl}}'\u003edig\u003c/a\u003e","sent_by_user":"Sendt af \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Sendt af \u003ca href='{{userUrl}}'\u003edig\u003c/a\u003e"},"directory":{"filter_name":"filtrér efter brugernavn","title":"Brugere","likes_given":"Givet","likes_received":"Modtaget","topics_entered":"Set","topics_entered_long":"Læste emner","time_read":"Læsetid","topic_count":"Emner","topic_count_long":"Emner oprettet","post_count":"Svar","post_count_long":"Svar sendt","no_results":"Ingen resultater fundet.","days_visited":"Besøg","days_visited_long":"Besøgsdage","posts_read":"Læste","posts_read_long":"Indlæg læst","total_rows":{"one":"%{count} bruger","other":"%{count} brugere"}},"group_histories":{"actions":{"change_group_setting":"Skift gruppe indstilling","add_user_to_group":"Tilføj bruger","remove_user_from_group":"Fjern bruger","make_user_group_owner":"Gør til ejer","remove_user_as_group_owner":"Fjern som ejer"}},"groups":{"member_added":"Tilføjet","member_requested":"Anmodet kl","add_members":{"title":"Tilføj Medlemmer","description":"Administrer medlemskab af denne gruppe","usernames":"Brugernavne"},"requests":{"title":"Anmodninger","reason":"Grund","accept":"Accepter","accepted":"accepteret","deny":"Nægt","denied":"Nægtet","undone":"anmodning fortrydt"},"manage":{"title":"Administrér","name":"Navn","full_name":"Fulde Navn","add_members":"Tilføj Medlemmer","delete_member_confirm":"Fjern '%{username}' fra '%{group}' gruppen?","profile":{"title":"Profil"},"interaction":{"title":"Interaktion","posting":"Sender","notification":"Notifikation"},"membership":{"title":"Medlemskab","access":"Adgang"},"logs":{"title":"Logs","when":"Når","action":"Handling","acting_user":"Fungerende bruger","target_user":"Målbruger","subject":"Subjekt","details":"Detaljer","from":"Fra","to":"Til"}},"public_admission":"Tillad brugere frit at tilmelde sig gruppen (Kræver at det er en offentlig synlig gruppe)","public_exit":"Tillad brugere frit at forlade gruppen","empty":{"posts":"Der er ingen indlæg skrevet af medlemmer i denne gruppe.","members":"Der er ingen medlemmer i denne gruppe.","requests":"Der er ingen anmodninger om medlemskab for denne gruppe.","mentions":"Denne gruppe bliver ikke nævnt nogen steder.","messages":"Der er ingen beskeder til denne gruppe.","topics":"Der er ingen emner skrevet af medlemmer i denne gruppe.","logs":"Der er ingen logning for denne gruppe."},"add":"Tilføj","join":"Tilslut","leave":"Forlad","request":"Forespørgsel","message":"Besked","confirm_leave":"Er du sikker på, at du vil forlade gruppen?","membership_request_template":"Brugerdefineret skabelon, der skal vises til brugere, når der sendes en medlemskabsanmodning","membership_request":{"submit":"Send forespørgsel","title":"Anmod om medlemskab af gruppen @%{group_name}","reason":"Fortæl gruppeejerne, hvorfor du tilhører denne gruppe"},"membership":"Medlemskab","name":"Navn","group_name":"Gruppe navn","user_count":"Brugere","bio":"Om Grupper","selector_placeholder":"indtast brugernavn","owner":"ejer","index":{"title":"Grupper","all":"Alle grupper","empty":"Der er ingen synlige grupper","filter":"Filtrer efter gruppe type","owner_groups":"Grupper, jeg ejer","close_groups":"Lukkede Grupper","automatic_groups":"Automatiske grupper","automatic":"Automatisk","closed":"Lukket","public":"Offentlig","private":"Privat","public_groups":"Offentlige grupper","automatic_group":"Automatisk gruppe","close_group":"Luk Gruppe","my_groups":"Mine grupper","group_type":"Gruppe type","is_group_user":"Bruger","is_group_owner":"Ejer"},"title":{"one":"Gruppe","other":"grupper"},"activity":"Aktivitet","members":{"title":"Brugere","filter_placeholder_admin":"brugernavn eller email","filter_placeholder":"brugernavn","remove_member":"Fjern Bruger","remove_member_description":"Fjern \u003cb\u003e%{username}\u003c/b\u003e fra denne gruppe","make_owner":"Lav Ejer","make_owner_description":"Gør \u003cb\u003e%{username}\u003c/b\u003e til ejer af denne gruppe","remove_owner":"Fjern som Ejer","remove_owner_description":"Fjern \u003cb\u003e%{username}\u003c/b\u003e som ejer af denne gruppe","owner":"Ejer","forbidden":"Du har ikke tilladelse til at se medlemmerne."},"topics":"Emner","posts":"Indlæg","mentions":"Omtaler","messages":"Beskeder","notification_level":"Standard notifikationsniveau for gruppebeskeder","alias_levels":{"mentionable":"Hvem kan @gruppenavn denne gruppe?","messageable":"Hvem kan sende en besked til denne gruppe?","nobody":"Ingen","only_admins":"Kun administratore","mods_and_admins":"Kun moderatore og administratore","members_mods_and_admins":"Kun gruppe medlemmer, moderatore og administratore","owners_mods_and_admins":"Kun gruppe ejere, moderatorer og administratorer","everyone":"Alle"},"notifications":{"watching":{"title":"Kigger","description":"Du får beskeder om hvert nyt indlæg i hver besked og antallet af nye svar bliver vist."},"watching_first_post":{"title":"Ser på første indlæg","description":"Du bliver underrettet om nye beskeder i denne gruppe, men ikke svar på beskeder."},"tracking":{"title":"Følger","description":"Du får besked hvis nogen nævner dit @navn eller svarer dig og antallet af nye svar bliver vist."},"regular":{"title":"Normal","description":"Du får besked hvis nogen nævner dit @navn "},"muted":{"title":"Tavs","description":"Du bliver ikke underrettet om noget om beskeder i denne gruppe."}},"flair_url":"Avatar Flair-billede","flair_url_placeholder":"(Valgfrit) Billed-URL eller Font Awesome klasse","flair_url_description":"Brug firkantede billeder, der ikke er mindre end 20px gange 20px eller FontAwesome-ikoner (accepterede formater: \"fa-icon\", \"far fa-icon\" eller \"fab fa-icon\").","flair_bg_color":"Avatar Flair-baggrundsfarve","flair_bg_color_placeholder":"(Valgfrit) Hex farveværdi","flair_color":"Avatar Flair-farve","flair_color_placeholder":"(Valgfrit) Hex farveværdi","flair_preview_icon":"Forhåndsvisning af ikonet","flair_preview_image":"Forhåndsvisning af billede"},"user_action_groups":{"1":"Likes givet","2":"Likes modtaget","3":"Bogmærker","4":"Emner","5":"Svar","6":"Svar","7":"Referencer","9":"Citater","11":"Ændringer","12":"Sendte indlæg","13":"Indbakke","14":"Afventende","15":"Kladder"},"categories":{"all":"alle kategorier","all_subcategories":"alle","no_subcategory":"ingen","category":"Kategori","category_list":"Vis liste over kategorier","reorder":{"title":"Ret kategoriernes rækkefølge ","title_long":"Omorganiser listen over kategorier","save":"Gem rækkefølge","apply_all":"Anvend","position":"Position"},"posts":"Indlæg","topics":"Emner","latest":"Seneste","latest_by":"seneste af","toggle_ordering":"vis/skjul rækkefølgeskifter","subcategories":"Underkategorier:","topic_sentence":{"one":"%{count} emne","other":"%{count} emner"},"topic_stat_sentence_week":{"one":"%{count} nyt emne i den sidste uge.","other":"%{count} nye emner i den sidste uge."},"topic_stat_sentence_month":{"one":"%{count} nyt emne den sidste måned.","other":"%{count} nye emner i den sidste måned."},"n_more":"Kategorier (%{count} mere) ..."},"ip_lookup":{"title":"IP-adresse opslag","hostname":"Værtsnavn","location":"Sted","location_not_found":"(ukendt)","organisation":"Organisation","phone":"Telefon","other_accounts":"Andre konti med denne IP adresse","delete_other_accounts":"Slet %{count}","username":"brugernavn","trust_level":"TL","read_time":"læse tid","topics_entered":"emner besøgt","post_count":"# indlæg","confirm_delete_other_accounts":"Er du sikker på, at du vil slette disse kontoer?","powered_by":"bruger \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"kopieret"},"user_fields":{"none":"(vælg en indstilling)"},"user":{"said":"{{username}}:","profile":"Profil","mute":"Mute","edit":"Redigér indstillinger","download_archive":{"button_text":"Hent alle","confirm":"Er du sikker på, at du vil downloade dine indlæg?","success":"Downloaden er startet. Du vil blive notificeret via en besked, når processen er færdig.","rate_limit_error":"Indlæg kan downloades en gang om dagen, prøv igen i morgen."},"new_private_message":"Ny Besked","private_message":"Besked","private_messages":"Beskeder","user_notifications":{"ignore_duration_title":"Ignorér timer","ignore_duration_username":"Brugernavn","ignore_duration_when":"Varighed:","ignore_duration_save":"Ignorér","ignore_duration_note":"Bemærk, at al ignorering fjernes automatisk, når ignoreringens varighed udløber.","ignore_duration_time_frame_required":"Vælg en tidsramme","ignore_no_users":"Du har ingen ignorerede brugere.","ignore_option":"Ignoreret","ignore_option_title":"Du modtager ikke notifikationer relateret til denne bruger, og alle deres emner og svar vil blive skjult.","add_ignored_user":"Tilføj...","mute_option":"Lydløs","mute_option_title":"Du vil ikke modtage nogen notifikationer relateret til denne bruger.","normal_option":"Normal","normal_option_title":"Du vil blive underrettet, hvis denne bruger svarer dig, citerer dig eller nævner dig."},"activity_stream":"Aktivitet","preferences":"Indstillinger","feature_topic_on_profile":{"open_search":"Vælg et nyt emne","title":"Vælg et emne","search_label":"Søg efter emne via titel","save":"Gem","clear":{"title":"Ryd"}},"profile_hidden":"Denne brugers offentlige profil er skjult.","expand_profile":"Udvid","collapse_profile":"Fald sammen","bookmarks":"Bogmærker","bio":"Om mig","timezone":"Tidszone","invited_by":"Inviteret af","trust_level":"Tillidsniveau","notifications":"Underretninger","statistics":"Statistik","desktop_notifications":{"label":"Live notifikationer","not_supported":"Notifikationer understøttes ikke af denne browser. Beklager.","perm_default":"Slå notifikationer til","perm_denied_btn":"Tilladelse nægtet","perm_denied_expl":"Du nægtede adgang for notifikationer. Tillad notifikationer via indstillingerne i din browser.","disable":"Deaktiver notifikationer","enable":"Aktiver notifikationer","each_browser_note":"Bemærk: Du skal ændre indstillingen i alle dine browsere.","consent_prompt":"Ønsker du live notifikationer, når folk svarer på dine indlæg?"},"dismiss":"Afvist","dismiss_notifications":"Afvis alle","dismiss_notifications_tooltip":"Marker alle ulæste notifikationer som læst","first_notification":"Din første notifikation! Vælg den for at begynde.","dynamic_favicon":"Vis tællinger på browser-ikonet","theme_default_on_all_devices":"Gør dette til standard temaet på alle mine enheder","text_size_default_on_all_devices":"Gør dette til standard tekststørrelse på alle mine enheder","allow_private_messages":"Tillad andre brugere at send mig personlige beskeder","external_links_in_new_tab":"Åbn alle eksterne links i en ny fane","enable_quoting":"Tillad citering af markeret tekst","enable_defer":"Aktivér 'udsæt' for at markere emner som ulæste","change":"skift","moderator":"{{user}} er moderator","admin":"{{user}} er admin","moderator_tooltip":"Denne bruger er moderator","admin_tooltip":"Denne bruger er administrator","silenced_tooltip":"Denne bruger er mådeholdt (silenced)","suspended_notice":"Denne bruger er suspenderet indtil {{date}}.","suspended_permanently":"Denne bruger er udelukket.","suspended_reason":"Begrundelse: ","github_profile":"Github","email_activity_summary":"Resumé over aktivitet","mailing_list_mode":{"label":"Mailing list tilstand","enabled":"Aktiverer mailing list tilstand","instructions":"Denne indstillilng har indflydelse på opsummeringen af aktiviteter.\u003cbr /\u003e\nFravalgte / 'muted' emner og kategorier fer ikke inkluderet i disse mails.\n","individual":"Send en email for hvert nyt indlæg","individual_no_echo":"Send en e-mail for hver nyt indlæg bortset fra mine egne","many_per_day":"Send mig en email for hvert nyt indlæg (omkring {{dailyEmailEstimate}} per dag)","few_per_day":"Send mig en email or hvert nyt indlæg (cirka 2 om dagen)","warning":"Mailing liste tilstand aktiveret. Email notifikation indstillinger tilsidesættes."},"tag_settings":"Tags","watched_tags":"Følger","watched_tags_instructions":"Du vil automatisk følge alle emner med disse tags. Du bliver informeret om alle nye indlæg og emner og antallet af nye indlæg bliver vises ved emnet.","tracked_tags":"Sporet","tracked_tags_instructions":"Du tracker automatisk alle emner med disse tags. Antallet af nye indlæg bliver vises ved hvert emne.","muted_tags":"Lydløs / 'muted'","muted_tags_instructions":"Du vil ikke få besked om nye emner med disse tags, og de vil ikke fremgå af 'seneste'.","watched_categories":"Overvåget","watched_categories_instructions":"Du overvåger automatisk alle emner i disse kategorier. Du får besked om alle nye indlæg og emner, og antallet af nye indlæg vises ved hvert emne.","tracked_categories":"Fulgt","tracked_categories_instructions":"Du tracker automatisk alle emner i disse kategorier. Antallet af nye indlæg vises ved hvert emne.","watched_first_post_categories":"Ser første indlæg","watched_first_post_categories_instructions":"Du vil blive adviseret om alle første indlæg, i emner, under disse kategorier","watched_first_post_tags":"Ser Første Indlæg","watched_first_post_tags_instructions":"Du får besked om første indlæg i hvert nyt emne med disse tags.","muted_categories":"Ignoreret","muted_categories_instructions":"Du vil ikke blive underrettet om noget om nye emner i disse kategorier, og de vises ikke på kategorierne eller de seneste sider.","muted_categories_instructions_dont_hide":"Du vil ikke blive underrettet om noget om nye emner i disse kategorier.","no_category_access":"Som moderator har du begrænset kategori-adgang, at gemme er slået fra. ","delete_account":"Slet min konto","delete_account_confirm":"Er du sikker på du vil slette din konto permanent? Dette kan ikke fortrydes!","deleted_yourself":"Din konto er nu slettet.","delete_yourself_not_allowed":"Kontakt en hjælperteam medlem, hvis du ønsker, at din konto bliver slettet.","unread_message_count":"Beskeder","admin_delete":"Slet","users":"Brugere","muted_users":"Ignoreret","muted_users_instructions":"Undertryk alle notifikationer fra disse brugere.","ignored_users":"Ignoreret","ignored_users_instructions":"Undertryk alle indlæg og notifikationer fra disse brugere.","tracked_topics_link":"Vis","automatically_unpin_topics":"Automatisk stop med at følge emner, når jeg når til bunden.","apps":"Apps","revoke_access":"Tilbagekald adgang","undo_revoke_access":"Revider tilbagekald adgang","api_approved":"Godkendt:","api_last_used_at":"Sidst brugt:","theme":"Tema","home":"Standard hjemmeside","staged":"Iscenesat","staff_counters":{"flags_given":"hjælpsomme markeringer","flagged_posts":"markerede indlæg","deleted_posts":"slettede indlæg","suspensions":"suspenderinger","warnings_received":"advarsler"},"messages":{"all":"Alle","inbox":"Indbakke","sent":"Sendt","archive":"Arkiv","groups":"Mine grupper","bulk_select":"Vælg beskeder","move_to_inbox":"Flyt til Indbakke","move_to_archive":"Arkiv","failed_to_move":"Kunne ikke flytte valgt beskeder (måske problemer med netværket)","select_all":"Vælg alle","tags":"Tags"},"preferences_nav":{"account":"Konto","profile":"Profil","emails":"E-mail","notifications":"Notifikationer","categories":"Kategorier","users":"Brugere","tags":"Tags","interface":"Grænseflade","apps":"Apps"},"change_password":{"success":"(e-mail sendt)","in_progress":"(sender e-mail)","error":"(fejl)","action":"Send e-mail til nulstilling af adgangskode","set_password":"Skriv password","choose_new":"Vælg et nyt kodeord","choose":"Vælg et kodeord"},"second_factor_backup":{"title":"To-faktor backup koder","regenerate":"Regenerér","disable":"Deaktiver","enable":"Aktiver","enable_long":"Aktivér backup koder","manage":"Administrér backup koder. Du har \u003cstrong\u003e{{count}}\u003c/strong\u003e backup koder tilbage.","copied_to_clipboard":"Kopierede til udklipsholder","copy_to_clipboard_error":"Fejl ved kopiering til udklipsholder","remaining_codes":"Du har \u003cstrong\u003e{{count}}\u003c/strong\u003e backup koder tilbage.","use":"Brug en backup kode","enable_prerequisites":"Du skal aktivere en primær anden faktor, før du genererer backup koder.","codes":{"title":"backup koder genereret","description":"Hver af disse backup koder kan kun bruges én gang. Opbevar dem et sted der er sikkert men tilgængeligt."}},"second_factor":{"title":"To-faktor godkendelse","enable":"Administrer To-faktor godkendelse","forgot_password":"Glemt kodeord?","confirm_password_description":"Bekræft dit kodeord for at fortsætte","name":"Navn","label":"Kode","rate_limit":"Vent venligst, før du prøver en anden godkendelseskode.","enable_description":"Scan denne QR-kode i en understøttet app ( \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e - \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e ), og indtast din godkendelseskode.\n","disable_description":"Indtast godkendelseskoden fra din app","show_key_description":"Indtast manuelt","short_description":"Beskyt din konto med engangs-sikkerhedskoder.\n","extended_description":"To-faktor godkendelse tilføjer ekstra sikkerhed til din konto ved at kræve en engangstoken ud over dit kodeord. Tokens kan genereres på \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid-\u003c/a\u003e og \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS-\u003c/a\u003e enheder.\n","oauth_enabled_warning":"Bemærk, at sociale logins deaktiveres, når To-faktor godkendelse er aktiveret på din konto.","use":"Brug Autentificeringsapp","enforced_notice":"Du skal aktivere To-faktor godkendelse før du kan gå ind på denne side.","disable":"deaktiver","disable_title":"Deaktiver anden faktor","disable_confirm":"Er du sikker på, at du vil deaktivere alle andre faktorer?","edit":"Rediger","edit_title":"Rediger anden faktor","edit_description":"Navn på anden faktor","enable_security_key_description":"Når du har din fysiske sikkerhedstast klar, skal du trykke på knappen Registrer nedenfor.","totp":{"title":"Token-baserede autentificatorer","add":"Ny autentifikator","default_name":"Min autentifikator"},"security_key":{"register":"Registrer","title":"Sikkerhedsnøgler","add":"Registrer sikkerhedsnøgle","delete":"Slet"}},"change_about":{"title":"Skift “Om mig”","error":"Der opstod en fejl i ændringen af denne værdi."},"change_username":{"title":"Skift brugernavn","confirm":"Er du helt sikker på, at du vil ændre dit brugernavn?","taken":"Beklager, det brugernavn er optaget.","invalid":"Det brugernavn er ugyldigt. Det må kun bestå af bogstaver og tal."},"change_email":{"title":"Skift e-mail-adresse","taken":"Beklager, den e-mail-adresse er optaget af en anden bruger.","error":"Der opstod en fejl i forbindelse med skift af din e-mail-adresse. Måske er adressen allerede i brug?","success":"Vi har sendt en e-mail til din nye adresse. Klik på linket i mail’en for at aktivere din nye e-mail-adresse.","success_staff":"Vi har sendt en email til din nuværende adresse. Følg bekræftelsesinstruktionerne."},"change_avatar":{"title":"Skift dit profilbillede","letter_based":"System tildelt profilbillede","uploaded_avatar":"Brugerdefineret profil billede","uploaded_avatar_empty":"Tilføj et brugerdefineret profil billede","upload_title":"Upload dit profil billede","image_is_not_a_square":"Advarsel: vi har klippet i billedet; bredde og højde var ikke ens."},"change_card_background":{"title":"Brugerkort-Baggrund","instructions":"Baggrunds billeder vil blive centreret og have en standard bredde på 590px."},"email":{"title":"E-mail","primary":"Primær email","secondary":"Sekundære emails","no_secondary":"Ingen sekundære emails","sso_override_instructions":"Email kan opdateres fra SSO-udbyderen.","instructions":"Vis aldrig offentligt","ok":"Vi vil sende dig en bekræftelses email","invalid":"Indtast venligst en gyldig email adresse","authenticated":"Din email er blevet bekræftet af {{provider}}","frequency_immediately":"Vi sender dig en email med det samme, hvis du ikke har læst den ting vi emailer dig om.","frequency":{"one":"Vi sender dig kun email, hvis vi ikke har set dig i det seneste minut.","other":"Vi sender dig kun email. hvis vi ikke har set dig i de sidste {{count}} minutter."}},"associated_accounts":{"title":"Tilknyttede konti","connect":"Opret forbindelse","revoke":"Fratag","cancel":"Afbryd","not_connected":"(ikke forbundet)","confirm_modal_title":"Tilslut %{provider}-konto","confirm_description":{"account_specific":"Din %{provider}-konto '%{account_description}' vil blive brugt til godkendelse.","generic":"Din %{provider}-konto vil blive brugt til godkendelse."}},"name":{"title":"Navn","instructions":"Dit fulde navn (valgfrit)","instructions_required":"Dit fulde navn","too_short":"Dit navn er for kort","ok":"Dit navn ser fint ud"},"username":{"title":"Brugernavn","instructions":"unikt, ingen mellemrum, kort","short_instructions":"Folk kan benævne dig som @{{username}}","available":"Dit brugernavn er tilgængeligt","not_available":"Ikke ledigt. Prøv {{suggestion}}?","not_available_no_suggestion":"Ikke tilgængelig","too_short":"Dit brugernavn er for kort","too_long":"Dit brugernavn er for langt","checking":"Kontrollerer om brugernavnet er ledigt…","prefilled":"E-mail svarer til dette registrerede brugernavn"},"locale":{"title":"sprog","instructions":"Brugerinterface sprog. Det skifter når de reloader siden.","default":"(standard)","any":"alle"},"password_confirmation":{"title":"Gentag adgangskode"},"auth_tokens":{"title":"Nyligt brugte enheder","ip":"IP","details":"Detaljer","log_out_all":"Log alle ud ","active":"aktiv nu","not_you":"Ikke dig?","show_all":"Vis alle ({{count}})","show_few":"Vis færre","was_this_you":"Var dette dig?","was_this_you_description":"Hvis det ikke var dig, anbefaler vi at ændre dit kodeord og logge ud overalt.","browser_and_device":"{{browser}} på {{device}}","secure_account":"Gør min konto sikker","latest_post":"Du sendte sidst ..."},"last_posted":"Sidste indlæg","last_emailed":"Sidste e-mail","last_seen":"Sidst set","created":"Oprettet","log_out":"Log ud","location":"Sted","website":"Site","email_settings":"E-mail","hide_profile_and_presence":"Skjul min offentlige profil og tilstedeværelsesfunktioner","enable_physical_keyboard":"Aktivér fysisk tastaturstøtte på iPad","text_size":{"title":"Skriftstørrelse","smaller":"Mindre","normal":"Normal","larger":"Større","largest":"Størst"},"title_count_mode":{"title":"Titel på baggrundssiden viser antal af:","notifications":"Nye notifikationer","contextual":"Nyt side indhold"},"like_notification_frequency":{"title":"Giv besked når liked","always":"Altid","first_time_and_daily":"Første gang et indlæg likes og dagligt","first_time":"Første gang et indlæg likes","never":"Aldrig"},"email_previous_replies":{"title":"Inkluder tidligere svar i bunden af emails","unless_emailed":"medmindre tidligere sendt","always":"altid","never":"aldrig"},"email_digests":{"title":"Når jeg ikke besøger her, send mig et email resume over populære emner og svar","every_30_minutes":"hvert 30. minut","every_hour":"hver time","daily":"dagligt","weekly":"ugenligt","every_month":"hver måned","every_six_months":"hver sjette måned"},"email_level":{"title":"Send mig en email når nogen citerer mig, svarer på mit indlæg, nævner mit @brugernavn eller inviterer mig til et emne","always":"altid","only_when_away":"kun når du er væk","never":"aldrig"},"email_messages_level":"Send mig en email når nogen sender mig en besked","include_tl0_in_digests":"Inkluder indhold fra nye brugere i opsummerende mails","email_in_reply_to":"Inkluder et uddrag af svaret indlæg i emails","other_settings":"Andre","categories_settings":"Kategorier","new_topic_duration":{"label":"Betragt emner som nye når","not_viewed":"Jeg har ikke set dem endnu","last_here":"oprettet siden jeg var her sidst","after_1_day":"oprettet indenfor den seneste dag","after_2_days":"oprettet i de seneste 2 dage","after_1_week":"oprettet i seneste uge","after_2_weeks":"oprettet i de seneste 2 uger"},"auto_track_topics":"Følg automatisk emner jeg åbner","auto_track_options":{"never":"aldrig","immediately":"med det samme","after_30_seconds":"efter 30 sekunder","after_1_minute":"efter 1 minut","after_2_minutes":"efter 2 minutter","after_3_minutes":"efter 3 minutter","after_4_minutes":"efter 4 minutter","after_5_minutes":"efter 5 minutter","after_10_minutes":"efter 10 minutter"},"notification_level_when_replying":"Når jeg skriver i et emne, sæt emnet som","invited":{"search":"tast for at søge invitationer…","title":"Invitationer","user":"Inviteret bruger","none":"Ingen invitationer at vise.","truncated":{"one":"Viser den første invitation.","other":"Viser de første {{count}} invitationer."},"redeemed":"Brugte invitationer","redeemed_tab":"Indløst","redeemed_tab_with_count":"Indløst ({{count}})","redeemed_at":"Invitation brugt","pending":"Afventende invitationer","pending_tab":"Afventende","pending_tab_with_count":"Ventende ({{count}})","topics_entered":"Emner åbnet","posts_read_count":"Indlæg læst","expired":"Denne invitation er forældet","rescind":"Fjern","rescinded":"Invitation fjernet","rescind_all":"Fjern alle udløbne invitationer","rescinded_all":"Alle udløbne invitationer fjernet!","rescind_all_confirm":"Er du sikker på, at du vil fjerne alle udløbne invitationer?","reinvite":"Gensend invitation","reinvite_all":"Gensend alle invitationer","reinvite_all_confirm":"Er du sikker på, at du vil sende alle invitationer igen?","reinvited":"Invitation gensendt","reinvited_all":"Alle invitationerne er gensendt!","time_read":"Læsetid","days_visited":"Besøgsdage","account_age_days":"Kontoens alder i dage","create":"Send en invitation","generate_link":"Kopier invitations-link","link_generated":"Invitiationslinket blev genereret!","valid_for":"Imvitationslinket er kun gyldigt for emailadressen: %{email}","bulk_invite":{"none":"Du har ikke inviteret noget endnu. Send individuelle invitationer eller inviter mange på en gang ved at \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003euploade en CSV-fil\u003c/a\u003e.","text":"Masse invitering fra en fil","success":"Fil uploaded successfuldt, du vil blive meddelt via en beskede når processen er fuldendt.","error":"Desværre, filen skal være CSV format.","confirmation_message":"Du er ved at sende email invitationer til alle i den uploadede fil."}},"password":{"title":"Adgangskode","too_short":"Din adgangskode er for kort.","common":"Den adgangskode er for udbredt.","same_as_username":"Dit password er det samme som dit brugernavn.","same_as_email":"Dit password er det samme som din email adresse.","ok":"Din adgangskode ser fin ud.","instructions":"mindst %{count} tegn"},"summary":{"title":"Statistik","stats":"Statistik","time_read":"læsetid","recent_time_read":"nylig læsetid","topic_count":{"one":"emne oprettet","other":"emner oprettet"},"post_count":{"one":"Indlæg oprettet","other":"Indlæg oprettet"},"likes_given":{"one":"givet","other":"givet"},"likes_received":{"one":"modtaget","other":"modtaget"},"days_visited":{"one":"dag besøgt","other":"dage besøgt"},"topics_entered":{"one":"emne set","other":"emner vist"},"posts_read":{"one":"Indlæg læst","other":"Indlæg læst"},"bookmark_count":{"one":"bogmærke","other":"bogmærker"},"top_replies":"Top svar","no_replies":"Ingen svar, endnu.","more_replies":"Flere svar","top_topics":"Top emner","no_topics":"Ingen emner endnu.","more_topics":"Flere emner","top_badges":"Top badges","no_badges":"Ingen 'badges' endnu.","more_badges":"Flere badges","top_links":"Top Links","no_links":"Ingen links, endnu","most_liked_by":"Mest Populære","most_liked_users":"Most Liked","most_replied_to_users":"Flest har responderet","no_likes":"Ingen likes, endnu.","top_categories":"Topkategorier","topics":"Emner","replies":"Svar"},"ip_address":{"title":"Sidste IP-adresse"},"registration_ip_address":{"title":"Registrerings IP adresse"},"avatar":{"title":"Profilbillede","header_title":"profil, beskeder, bogmærker og indstillinger."},"title":{"title":"Titel","none":"(ingen)"},"primary_group":{"title":"Primær gruppe","none":"(ingen)"},"filters":{"all":"Alle"},"stream":{"posted_by":"Skrevet af","sent_by":"Sendt af","private_message":"besked","the_topic":"emnet"}},"loading":"Indlæser…","errors":{"prev_page":"da vi prøvede at indlæse","reasons":{"network":"Netværksfejl","server":"Server fejl","forbidden":"Adgang nægtet","unknown":"Fejl","not_found":"Side ikke fundet"},"desc":{"network":"Tjek din internetforbindelse.","network_fixed":"Det ser ud som om den er tilbage.","server":"Fejlkode: {{status}}","forbidden":"Du har ikke tilladelser til at se det","not_found":"Ups, programmet forsøgte at indlæse en URL der ikke eksisterer.","unknown":"Noget gik galt."},"buttons":{"back":"Gå tilbage","again":"Prøv igen","fixed":"Indlæs side"}},"modal":{"close":"luk"},"close":"Luk","assets_changed_confirm":"Dette site er lige blevet opdateret. Vil du opdatere nu til den seneste version?","logout":"Du er blevet logget ud.","refresh":"Opdater","read_only_mode":{"enabled":"Dette website kan kun læses lige nu. Fortsæt endelig med at kigge, men der kan ikke svares, likes eller andet indtil videre.","login_disabled":"Log in er deaktiveret midlertidigt, da forummet er i \"kun læsnings\" tilstand.","logout_disabled":"Log ud er deaktiveret mens websitet er i læs kun tilstand"},"logs_error_rate_notice":{},"learn_more":"Læs mere…","all_time":"i alt","all_time_desc":"emner oprettet i alt","year":"år","year_desc":"Indlæg oprettet i de seneste 365 dage","month":"måned","month_desc":"Indlæg oprettet i de seneste 30 dage","week":"uge","week_desc":"Indlæg oprettet i de seneste 7 dage","day":"dag","first_post":"Første indlæg","mute":"Mute","unmute":"Unmute","last_post":"Sendt","time_read":"Læste","time_read_recently":"%{time_read} for nylig","time_read_tooltip":"%{time_read} samlet læst tid","time_read_recently_tooltip":"%{time_read} samlet tid læst (%{recent_time_read} i de sidste 60 dage)","last_reply_lowercase":"seneste svar","replies_lowercase":{"one":"svar","other":"svar"},"signup_cta":{"sign_up":"Tilmeld dig","hide_session":"Mind mig om det i morgen","hide_forever":"nej tak","hidden_for_session":"OK, jeg spørger dig i morgen. Du kan altid bruge 'Log ind' til at oprette en konto.","intro":"Hej! Det ser ud til, at du nyder diskussionen, men du har ikke tilmeldt dig en konto endnu.","value_prop":"Når du opretter en konto, husker vi nøjagtigt, hvad du har læst, så du altid kommer tilbage, hvor du slap. Du får også notifikationer her og via email, når nogen svarer til dig. Og du kan synes godt om indlæg for at dele kærligheden. : Heartpulse:"},"summary":{"enabled_description":"Du ser et sammendrag af dette emne: kun de mest interessante indlæg som andre finder interresante.","description":"Der er \u003cb\u003e{{replyCount}}\u003c/b\u003e svar.","description_time":"Der er \u003cb\u003e{{replyCount}}\u003c/b\u003e svar med en estimeret læsetid på \u003cb\u003e{{readingTime}} minutter\u003c/b\u003e.","enable":"Opsummér dette emne","disable":"Vis alle indlæg"},"deleted_filter":{"enabled_description":"Dette emne indeholder slettede indlæg, som er blevet skjult.","disabled_description":"Slettede indlæg bliver vist. ","enable":"Skjul Slettede Indlæg","disable":"Vis Slettede Indlæg"},"private_message_info":{"title":"Besked","invite":"Invitér andre ...","edit":"Tilføj eller fjern ...","leave_message":"Vil du virkelig forlade denne besked?","remove_allowed_user":"Ønsker du virkelig at fjerne {{name}} fra denne samtale?","remove_allowed_group":"Er du sikker på du vil fjerne {{name}} fra denne besked?"},"email":"E-mail","username":"Brugernavn","last_seen":"Sidst set","created":"Oprettet","created_lowercase":"Oprettet","trust_level":"Tillidsniveau","search_hint":"brugernavn, email eller IP adresse","create_account":{"disclaimer":"Ved at registrere dig accepterer du \u003ca href='{{privacy_link}}' target='blank'\u003ePrivatlivsbetingelser\u003c/a\u003e og \u003ca href='{{tos_link}}' target='blank'\u003eservicevilkårene\u003c/a\u003e .","title":"Opret konto","failed":"Noget gik galt. Måske er e-mail-adressen allerede registreret – prøv “Jeg har glemt min adgangskode”-linket"},"forgot_password":{"title":"Nulstil kodeord","action":"Jeg har glemt min adgangskode","invite":"Skriv brugernavn eller e-mail-adresse, så sender vi dig en mail så du kan nulstille din adgangskode.","reset":"Nulstil adgangskode","complete_username":"Hvis en konto matcher brugernavnet \u003cb\u003e%{username}\u003c/b\u003e, vil du om lidt modtage en email med instruktioner om hvordan man nulstiller passwordet.","complete_email":"Hvis en konto matcher \u003cb\u003e%{email}\u003c/b\u003e, vil du om lidt modtage en email med instruktioner om hvordan man nulstiller passwordet.","complete_username_not_found":"Ingen kontoer passer til brugernavnet \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Ingen kontoer svarer til \u003cb\u003e%{email}\u003c/b\u003e","help":"Email ikke modtaget? Sørg for først at checke din spam-mappe. \u003cp\u003e Ikke sikker på, hvilken emailadresse du brugte? Indtast en emailadresse, så fortæller vi dig, om den findes her. \u003c/p\u003e\u003cp\u003e Hvis du ikke længere har adgang til emailadressen på din konto, skal du kontakte \u003ca href='%{basePath}/about'\u003evores hjælpsomme hjælperteam.\u003c/a\u003e \u003c/p\u003e","button_ok":"OK","button_help":"Hjælp"},"email_login":{"link_label":"Email mig et login link ","button_label":"med email","complete_username":"Hvis en konto matcher brugernavnet \u003cb\u003e%{username}\u003c/b\u003e , vil du snart modtage en email med et login link.","complete_email":"Hvis en konto matcher \u003cb\u003e%{email}\u003c/b\u003e , vil du snart modtage en email med et login link.","complete_username_found":"Vi fandt en konto, der matcher brugernavnet \u003cb\u003e%{username}\u003c/b\u003e , du vil snart modtage en email med et login link.","complete_email_found":"Vi fandt en konto, der matcher \u003cb\u003e%{email}\u003c/b\u003e , du vil snart modtage en email med et login link.","complete_username_not_found":"Ingen kontoer passer til brugernavnet \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Ingen kontoer svarer til \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"Fortsæt til %{site_name}","logging_in_as":"Logger ind som %{email}","confirm_button":"Afslut login"},"login":{"title":"Log ind","username":"Bruger","password":"Adgangskode","second_factor_title":"To-faktor godkendelse","second_factor_description":"Indtast godkendelseskoden fra din app:","second_factor_backup_title":"To-faktor backup","second_factor_backup_description":"Indtast en af dine backup koder:","email_placeholder":"e-mail eller brugernavn","caps_lock_warning":"Caps Lock er sat til","error":"Ukendt fejl","cookies_error":"Din browser ser ud til at have deaktiveret cookies. Du kan muligvis ikke lave et log ind, uden at aktivere dem først.","rate_limit":"Vent venligst, før du prøver at logge på igen.","blank_username":"Indtast din email eller brugernavn.","blank_username_or_password":"Skriv din email adresse eller brugernavn og dit password","reset_password":"Nulstil adgangskode","logging_in":"Logger ind...","or":"Eller","authenticating":"Logger ind…","awaiting_activation":"Din konto mangler at blive aktiveret. Brug “Jeg har glemt min adgangskode”-linket for at få en ny aktiverings-mail.","awaiting_approval":"Din konto er ikke blevet godkendt af en moderator endnu. Du får en e-mail når den bliver godkendt.","requires_invite":"Beklager, det kræve en invitation at blive medlem af dette forum.","not_activated":"Du kan ikke logge ind endnu. Vi har tidligere sendt en aktiverings-e-mail til dig på \u003cb\u003e{{sentTo}}\u003c/b\u003e. Følg venligst instruktionerne i den e-mail for at aktivere din konto.","not_allowed_from_ip_address":"Du kan ikke logge ind fra den IP adresse.","admin_not_allowed_from_ip_address":"Du kan ikke logge på som administrator fra denne IP adresse.","resend_activation_email":"Klik her for at sende aktiverings-e-mail’en igen.","omniauth_disallow_totp":"Din konto har To-faktor godkendelse aktiveret. Log ind med dit kodeord.","resend_title":"Gensend Aktiverings-e-mail","change_email":"Skift e-mailadresse","provide_new_email":"Angiv en ny adresse og vi fremsender din bekræftelses-e-mail påny. ","submit_new_email":"Opdater e-mailadresse","sent_activation_email_again":"Vi har sendt endnu en aktiverings-e-mail til dig på \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Det kan tage nogen få minutter før den når frem; kontrollér også din spam-mappe.","sent_activation_email_again_generic":"Vi har sendt en anden aktiveringsemail. Det kan tage et par minutter, før det ankommer; husk at checke din spam-mappe.","to_continue":"Log venligst ind","preferences":"Du skal være logget ind for at ændre præferencer.","forgot":"Jeg kan ikke huske min kontos detaljer","not_approved":"Din konto er endnu ikke blevet godkendt. Du får besked via e-mail når du kan logge ind.","google_oauth2":{"name":"Google","title":"med google"},"twitter":{"name":"Twitter","title":"med Twitter"},"instagram":{"name":"Instagram","title":"med Instagram"},"facebook":{"name":"Facebook","title":"med Facebook"},"github":{"name":"GitHub","title":"med GitHub"},"discord":{"name":"Discord","title":"med Discord"}},"invites":{"accept_title":"Invitation","welcome_to":"Velkommen til %{site_name}!","invited_by":"Du blev inviteret af:","social_login_available":"Du vil også kunne logge ind med enhvert socialt login med brug af denne e-mail.","your_email":"E-mail-adressen knyttet til kontoen er \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"Accepter Invitation","success":"Din konto er blevet oprettet, og du er nu logget ind.","name_label":"Navn","password_label":"Sæt Kodeord","optional_description":"(valgfri)"},"password_reset":{"continue":"Fortsæt til %{site_name}"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Kun Kategorier","categories_with_featured_topics":"Kategorier med Fremhævede Emner","categories_and_latest_topics":"Kategorier og Seneste Emner","categories_and_top_topics":"Kategorier og top emner","categories_boxes":"Kasser med underkategorier","categories_boxes_with_topics":"Kasser med udvalgte emner"},"shortcut_modifier_key":{"shift":"Skift","ctrl":"Ctrl","alt":"Alt","enter":"Indtast"},"conditional_loading_section":{"loading":"Loader..."},"category_row":{"topic_count":"{{count}} emner i denne kategori"},"select_kit":{"default_header_text":"Vælg...","no_content":"Ingen match fundet","filter_placeholder":"Søg...","filter_placeholder_with_any":"Søg eller opret ...","create":"Opret: '{{content}}'","max_content_reached":{"one":"Du kan kun vælge {{count}}punkt.","other":"Du kan kun vælge {{count}}punkter."},"min_content_not_reached":{"one":"Vælg mindst {{count}}punkt.","other":"Vælg mindst {{count}}punkter."}},"date_time_picker":{"from":"Fra","to":"Til","errors":{"to_before_from":"Til dato skal være senere end fra dato."}},"emoji_picker":{"filter_placeholder":"Søg efter humørikon","smileys_\u0026_emotion":"Smilys og følelser","people_\u0026_body":"Mennesker og krop","animals_\u0026_nature":"Dyr og natur","food_\u0026_drink":"Mad og drikke","travel_\u0026_places":"Rejser og steder","activities":"Aktiviteter","objects":"Objekter","symbols":"Symboler","flags":"Markeringer","recent":"For nylig brugt","default_tone":"Ingen hudfarve","light_tone":"Lys hudfarve","medium_light_tone":"Medium lys hudfarve","medium_tone":"Medium hudfarve","medium_dark_tone":"Medium mørk hudfarve","dark_tone":"Mørk skin tone","default":"Brugerdefineret humørikoner"},"shared_drafts":{"title":"Delte kladder","notice":"Dette emne er kun synligt for dem, der kan se kategorien \u003cb\u003e{{category}}\u003c/b\u003e .","destination_category":"Destinations-kategori","publish":"Offentliggør delt kladde","confirm_publish":"Er du sikker på, at du vil offentliggøre dette udkast?","publishing":"Offentliggør emne..."},"composer":{"emoji":"Emoji :)","more_emoji":"mere...","options":"Indstillinger","whisper":"hvisken","unlist":"Ikke listede","blockquote_text":"Citatblok","add_warning":"Dette er en officiel advarsel.","toggle_whisper":"Slå hvisken til/fra","toggle_unlisted":"Slå listning til/fra","posting_not_on_topic":"Hvilket emne vil du svare på?","saved_local_draft_tip":"gemt lokalt","similar_topics":"Dit emne minder om…","drafts_offline":"kladder offline","edit_conflict":"rediger konflikt","group_mentioned_limit":"\u003cb\u003eAdvarsel!\u003c/b\u003e Du nævnte \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e , men denne gruppe har flere medlemmer end administratorens konfigurerede omtale-grænse for {{max}} brugere. Ingen bliver underrettet.","group_mentioned":{"one":"Ved at nævne {{group}} sender du en notifikation til \u003ca href='{{group_link}}'\u003e%{count} person\u003c/a\u003e - vil du fortsætte?","other":"Ved at nævne {{group}} sender du en notifikation til \u003ca href='{{group_link}}'\u003e{{count}} personer\u003c/a\u003e - vil du fortsætte?"},"cannot_see_mention":{"category":"Du nævnte {{username}}, men de vil ikke blive notificeret fordi de ikke har adgang til denne kategori. Du vil være nødt til at tilføje dem til en gruppe, der har adgang til kategori.","private":"Du nævnte {{username}}, men de vil ikke blive notificeret fordi de ikke er i stand til at se denne personlige besked. Du vil være nødt til at invitere dem til denne personlige besked."},"duplicate_link":"Det ser ud til, at dit link til \u003cb\u003e{{domain}}\u003c/b\u003e allerede var sendt i emnet af \u003cb\u003e@ {{username}}\u003c/b\u003e i \u003ca href='{{post_url}}'\u003eet svar på {{ago}}\u003c/a\u003e - er du sikker på, at du vil sende det igen?","reference_topic_title":"RE: {{title}}","error":{"title_missing":"Titlen er påkrævet","title_too_short":"Titlen skal være på mindst {{min}} tegn","title_too_long":"Titlen skal være kortere end {{max}} tegn.","post_missing":"Indlæg kan ikke være tomt","post_length":"Indlægget skal være på mindst {{min}} tegn.","try_like":"Har du prøvet {{heart}}knappen?","category_missing":"Du skal vælge en kategori.","tags_missing":"Du skal vælge mindst {{count}}-tags"},"save_edit":"Gem ændringer","overwrite_edit":"Overskriv redigering","reply_original":"Svar til det oprindelige emne","reply_here":"Svar her","reply":"Svar","cancel":"Annullér","create_topic":"Opret emne","create_pm":"Besked","create_whisper":"Hvisk","create_shared_draft":"Opret delt kladde","edit_shared_draft":"Rediger delt kladde","title":"Eller tryk Ctrl+Enter","users_placeholder":"Tilføj bruger","title_placeholder":"Hvad handler diskussionen om i korte træk?","title_or_link_placeholder":"Skriv titlen eller indsæt et link her","edit_reason_placeholder":"hvorfor redigerer du?","topic_featured_link_placeholder":"Indtast link som vises med titel.","remove_featured_link":"Fjern link fra emne.","reply_placeholder":"Skriv her. Brug Markdown, BBCode eller HTML til at formattere. Træk eller indsæt billeder.","reply_placeholder_no_images":"Skriv her. Brug Markdown, BBCode eller HTML til at formatere.","reply_placeholder_choose_category":"Vælg en kategori, før du skriver her.","view_new_post":"Se dit nye indlæg.","saving":"Gemmer.","saved":"Gemt!","uploading":"Uploader…","show_preview":"forhåndsvisning \u0026raquo;","hide_preview":"\u0026laquo; skjul forhåndsvisning","quote_post_title":"Citér hele indlægget","bold_label":"B","bold_title":"Fed","bold_text":"fed skrift","italic_label":"I","italic_title":"Kursiv","italic_text":"kursiv skrift","link_title":"Link","link_description":"skriv linkets beskrivelse her","link_dialog_title":"Indsæt link","link_optional_text":"evt. titel","quote_title":"Citatblok","quote_text":"Citatblok","code_title":"Præformateret tekst","code_text":"indryk præformateret tekst med 4 mellemrum","paste_code_text":"skriv eller indsæt kode her","upload_title":"Billede","upload_description":"skriv billedets beskrivelse her","olist_title":"Nummereret liste","ulist_title":"Punktopstilling","list_item":"Listepunkt","toggle_direction":"Vis/skjul retning ","help":"Hjælp til Markdown-redigering","collapse":"minimer forfatter panelet","open":"åbn forfatter panelet","abandon":"luk forfatter og kassér kladde","enter_fullscreen":"gå i 'fullscreen composer'","exit_fullscreen":"gå ud af 'fullscreen composer'","modal_ok":"OK","modal_cancel":"Annuller","cant_send_pm":"Beklager, du kan ikke sende en besked til %{username}.","yourself_confirm":{"title":"Glemte du at tilføje modtagere?","body":"Lige nu bliver denne besked kun sendt til dig selv!"},"admin_options_title":"Valgfrie staff-indstillinger for dette emne","composer_actions":{"reply":"Svar","draft":"Kladde","edit":"Rediger","reply_to_post":{"label":"Besvar et indlæg %{postNumber} af %{postUsername}","desc":"Besvar et specifikt indlæg"},"reply_as_new_topic":{"label":"Besvar som linket emne","desc":"Opret et nyt emne, der er knyttet til dette emne"},"reply_as_private_message":{"label":"Ny besked","desc":"Opret en ny privat besked"},"reply_to_topic":{"label":"Besvar emne","desc":"Besvar emnet, ikke noget specifikt indlæg"},"toggle_whisper":{"label":"Slå hvisken til/fra","desc":"Hvisken er kun synlige for hjælperteam medlemmer"},"create_topic":{"label":"Nyt emne"},"shared_draft":{"label":"Delt Kladde","desc":"Lav en kladde til et emne, der kun er synligt for hjælperteam"},"toggle_topic_bump":{"label":"Slå emne 'bump' til/fra","desc":"Svar uden at ændre den seneste svardato"}},"details_title":"Resume","details_text":"Denne tekst vil blive skjult"},"notifications":{"tooltip":{"regular":{"one":"%{count} uset notifikation","other":"{{count}} usete notifikationer"},"message":{"one":"%{count} ulæst besked","other":"{{count}} ulæste beskeder"}},"title":"notifikationer ved @navns nævnelse, svar på dine indlæg og emner, beskeder, mv.","none":"Ikke i stand til at indlæse notifikationer for tiden.","empty":"Ingen notifikationer fundet.","post_approved":"Dit indlæg blev godkendt","reviewable_items":"genstande, der kræver gennemgang","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} og %{count} anden\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} og {{count}} andre\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"kunne godt lide {{count}} af dine indlæg","other":"syntes godt om {{count}} af dine indlæg"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e accepterede din invitation","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e flyttede {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"Optjent '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eNyt emne\u003c/span\u003e {{description}}","group_message_summary":{"one":"{{count}} besked i din {{group_name}} indbakke","other":"{{count}} beskeder i din {{group_name}} indbakke"},"popup":{"mentioned":"{{username}} nævnte dig i \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} nævnte dig i \"{{topic}}\" - {{site_title}}","quoted":"{{username}} citerede dig i \"{{topic}}\" - {{site_title}}","replied":"{{username}} svarede dig i \"{{topic}}\" - {{site_title}}","posted":"{{username}} skrev i \"{{topic}}\" - {{site_title}}","private_message":"{{username}} sendte dig en privat besked i \"{{topic}}\" - {{site_title}}","linked":"{{username}} linkede til dit indlæg fra \"{{topic}}\" - {{site_title}}","watching_first_post":"{{username}} oprettet et nyt emne\"{{topic}}\" - {{site_title}}","confirm_title":"Notifikationer aktiveret - %{site_title}","confirm_body":"Succes! notifikationer er aktiveret.","custom":"Notifikation fra {{username}}på %{site_title}"},"titles":{"mentioned":"nævnte","replied":"nyt svar","quoted":"citeret","edited":"redigeret","liked":"nyt like","private_message":"ny privat besked","invited_to_private_message":"inviteret til privat besked","invitee_accepted":"invitation accepteret","posted":"nyt indlæg","moved_post":"indlæg flyttet","linked":"linket","granted_badge":"badge tildelt","invited_to_topic":"inviteret til emne","group_mentioned":"nævnt gruppe","group_message_summary":"nye gruppe beskeder","watching_first_post":"nyt emne","topic_reminder":"emne påmindelse","liked_consolidated":"nye likes","post_approved":"indlæg godkendt"}},"upload_selector":{"title":"Indsæt billede","title_with_attachments":"Tilføj et billede eller en fil","from_my_computer":"Fra min computer","from_the_web":"Fra nettet","remote_tip":"link til billede","remote_tip_with_attachments":"link til billede eller fil {{authorized_extensions}}","local_tip":"vælg billeder fra din enhed","local_tip_with_attachments":"vælg billeder eller filer fra din enhed {{authorized_extensions}}","hint":"(du kan også trække og slippe ind i editoren for at uploade dem)","hint_for_supported_browsers":"du kan også bruge træk-og-slip eller indsætte billeder i editoren","uploading":"Uploader billede","select_file":"Vælg fil","default_image_alt_text":"billede"},"search":{"sort_by":"Sorter efter","relevance":"Relevans","latest_post":"Seneste indlæg","latest_topic":"Seneste Emne","most_viewed":"Mest sete","most_liked":"Mest likede","select_all":"Vælg alle","clear_all":"Ryd alle","too_short":"Dit søgekriterie er for kort.","result_count":{"one":"\u003cspan\u003e%{count} resultat for\u003c/span\u003e \u003cspan class='term'\u003e{{term}}\u003c/span\u003e","other":"\u003cspan\u003e{{count}}{{plus}} resultater for\u003c/span\u003e \u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"title":"søg efter emner, indlæg, brugere eller kategorier","full_page_title":"søg emner eller indlæg","no_results":"Ingen resultater fundet.","no_more_results":"Ikke flere resultater.","searching":"Søger…","post_format":"#{{post_number}} af {{username}}","results_page":"Søgeresultater for '{{term}}'","more_results":"Der er flere resultater. Begræns dine søgekriterier.","cant_find":"Kan du ikke finde det, du leder efter?","start_new_topic":"Start måske et nyt emne?","or_search_google":"Eller prøv at søge med Google i stedet:","search_google":"Prøv at søge med Google i stedet:","search_google_button":"Google","search_google_title":"Søg denne side","context":{"user":"Søg i indlæg fra @{{username}}","category":"Søg i #{{category}} kategorien","topic":"Søg i dette emne","private_messages":"Søg i beskeder"},"advanced":{"title":"Avanceret Søgning","posted_by":{"label":"Skrevet af"},"in_category":{"label":"Kategoriseret"},"in_group":{"label":"I Gruppen"},"with_badge":{"label":"Med Badge"},"with_tags":{"label":"tagget"},"filters":{"label":"Returner kun emner / indlæg ...","title":"Kun matchende i titel","likes":"Jeg syntes om","posted":"Jeg skrev i","watching":"Jeg overvåger","tracking":"Jeg følger","private":"I mine beskeder","bookmarks":"Jeg bogmærkede","first":"er det allerførste indlæg","pinned":"er fastgjort","unpinned":"er ikke fastgjort","seen":"jeg læser","unseen":"Jeg har ikke læst","wiki":"er wiki","images":"inkludér billede(r)","all_tags":"Alle ovenstående tags"},"statuses":{"label":"Hvor emner","open":"er åbne","closed":"er lukkede","archived":"er arkiverede","noreplies":"har ingen svar","single_user":"indeholder en enkelt bruger"},"post":{"count":{"label":"Minimum for antal indlæg"},"time":{"label":"Sendt","before":"før","after":"efter"}}}},"hamburger_menu":"gå til en anden emneliste eller kategori","new_item":"ny","go_back":"gå tilbage","not_logged_in_user":"bruger side, med oversigt over aktivitet og indstillinger","current_user":"gå til brugerside","view_all":"vis alle","topics":{"new_messages_marker":"sidste besøg","bulk":{"select_all":"Vælg alle","clear_all":"Ryd alle","unlist_topics":"Fjern emner fra liste","relist_topics":"Genindlæs emner","reset_read":"Nulstil \"læst\"","delete":"Slet emner","dismiss":"Afvis","dismiss_read":"Afvis alle ulæste","dismiss_button":"Afvis...","dismiss_tooltip":"Afvis kun nye indlæg eller stop med at følge emner","also_dismiss_topics":"Stop med at følge disse emner så de aldrig mere kommer op som ulæste igen","dismiss_new":"Afvis nye","toggle":"vælg flere emner af gangen","actions":"Handlinger på flere indlæg","change_category":"Indstil kategori","close_topics":"Luk indlæg","archive_topics":"Arkiver Emner","notification_level":"Notifikationer","choose_new_category":"Vælg den nye kategori for emnerne:","selected":{"one":"Du har valgt \u003cb\u003e%{count}\u003c/b\u003e indlæg.","other":"Du har valgt \u003cb\u003e{{count}}\u003c/b\u003e indlæg."},"change_tags":"Erstat Tags","append_tags":"Tilføj Tags","choose_new_tags":"Vælg nye tags for dette emne","choose_append_tags":"Vælg nye tags til at tilføje emnet:","changed_tags":"Tags for dette emne blev ændret"},"none":{"unread":"Du har ingen ulæste emner.","new":"Du har ingen nye emner.","read":"Du har ikke læst nogen emner endnu.","posted":"Du har ikke skrevet nogen indlæg endnu.","latest":"Der er ikke nogen nye emner. Det er sørgeligt.","bookmarks":"Du har ingen bogmærkede emner endnu.","category":"Der er ingen emner i kategorien {{category}}.","top":"Der er ingen top emner","educate":{"new":"\u003cp\u003eDine nye emner vises her.\u003c/p\u003e\u003cp\u003eSom standard, betragtes emner som ulæste og vil vise en \u003cspan class=\"badge new-posts badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003eny\u003c/span\u003e indikator hvis de var oprettet indenfor de sidste 2 dage\u003c/p\u003e\u003cp\u003eDu kan ændre dette i dine \u003ca href=\"%{userPrefsUrl}\"\u003eindstillinger\u003c/a\u003e\u003c/p\u003e","unread":"\u003cp\u003eDine nye emner vises her.\u003c/p\u003e\u003cp\u003eSom standard, betragtes emner som ulæste og vil vise en \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e hvis du:\u003c/p\u003e\u003cul\u003e\u003cli\u003eOprettede dette emne\u003c/li\u003e\u003cli\u003eSvarede dette emne\u003c/li\u003e\u003cli\u003eLæste emnet i mere end 4 minutter\u003c/li\u003e\u003c/ul\u003e\u003cp\u003e Eller hvis du udtrykkeligt sat emnet til Sporet eller Følger via notifikations indstillinger i bunden af hvert emne.\u003c/p\u003e\u003cp\u003e Tilgå dine \u003ca href=\"%{userPrefsUrl}\"\u003eindstillinger\u003c/a\u003e for at ændre dette.\u003c/p\u003e"}},"bottom":{"latest":"Der er ikke flere populære emner.","posted":"Der er ikke flere emner.","read":"Der er ikke flere læste emner.","new":"Der er ikke flere nye emner.","unread":"Der er ikke flere ulæste emner.","category":"Der er ikke flere emner i kategorien {{category}}.","top":"Der er ikke flere top emner","bookmarks":"Der er ikke flere bogmærkede emner."}},"topic":{"filter_to":{"one":"%{count} indlæg i emnet","other":"{{count}} indlæg i emnet"},"create":"Nyt emne","create_long":"Opret et nyt emne i debatten","open_draft":"Åben kladde","private_message":"Start en besked","archive_message":{"help":"Flyt beskeder til dit arkiv","title":"Arkiv"},"move_to_inbox":{"title":"Flyt til Indbakke","help":"Flyt beskeder tilbage til Indbakke"},"edit_message":{"help":"Rediger det første indlæg af beskeden","title":"Rediger Besked"},"defer":{"help":"Markér som ulæst","title":"Udsæt"},"list":"Emner","new":"nyt emne","unread":"ulæste","new_topics":{"one":"%{count} nyt emne","other":"{{count}} nye emner"},"unread_topics":{"one":"%{count} ulæst emne","other":"{{count}} ulæste emner"},"title":"Emne","invalid_access":{"title":"Emnet er privat","description":"Beklager, du har ikke adgang til dette emne!","login_required":"Do skal logge på for at se dette emne."},"server_error":{"title":"Emnet kunne ikke indlæses","description":"Beklager, vi kunne ikke indlæse det emne, muligvis grundet et problem med netværksforbindelsen. Prøv venligst igen. Hvis problemet fortæstter, så skriv venligst til os."},"not_found":{"title":"Emnet findes ikke","description":"Beklager, vi kunne ikke finde det emne i databasen. Måske er det blevet fjernet af moderator?"},"total_unread_posts":{"one":"der er {{count}} indlæg du ikke har læst i dette emne","other":"der er {{count}} indlæg du ikke har læst i dette emne"},"unread_posts":{"one":"der er %{count} indlæg du ikke har læst i dette emne","other":"der er {{count}} indlæg du ikke har læst i dette emne"},"new_posts":{"one":"der er kommet %{count} nyt indlæg i dette emne siden du læste det sidst","other":"der er kommet {{count}} nye indlæg i dette emne siden du læste det sidst"},"likes":{"one":"der er ét like i dette emne","other":"der er {{count}} likes i dette emne"},"back_to_list":"Tilbage til emneoversigt","options":"Emneindstillinger","show_links":"vis links i dette emne","toggle_information":"vis/skjul emne detaljer","read_more_in_category":"Mere læsestof? Se andre emner i {{catLink}} eller {{latestLink}}.","read_more":"Mere læsestof? {{catLink}} eller {{latestLink}}.","group_request":"Du skal anmode om medlemskab af gruppen '{{name}}' for at se dette emne","group_join":"Du skal være medlem af gruppen '{{name}}' for at se dette emne","group_request_sent":"Din anmodning om gruppe medlemskab er sendt. Du får besked, når den accepteres.","browse_all_categories":"Vis alle kategorier","view_latest_topics":"vis seneste emner","suggest_create_topic":"Hvorfor ikke oprette et emne?","jump_reply_up":"hop til tidligere svar","jump_reply_down":"hop til senere svar","deleted":"Emnet er blevet slettet","topic_status_update":{"title":"Emne timer","save":"Indstil timerfunktion","num_of_hours":"Antal timer:","remove":"Fjern timerfunktion","publish_to":"Udgiv I:","when":"Hvornår:","public_timer_types":"Emne timere","private_timer_types":"bruger emne timers","time_frame_required":"Vælg en tidsramme"},"auto_update_input":{"none":"Vælg en tidsramme","later_today":"Senere i dag","tomorrow":"I morgen","later_this_week":"Senere på ugen","this_weekend":"Denne weekend","next_week":"Næste uge","two_weeks":"To Uger","next_month":"Næste Månede","two_months":"To måneder","three_months":"Tre Måneder","four_months":"Fire måneder","six_months":"Seks Måneder","one_year":"Et år","forever":"Forevigt","pick_date_and_time":"Vælg dato og tid","set_based_on_last_post":"Luk baseret på seneste indlæg"},"publish_to_category":{"title":"Planlæg Udgivelse"},"temp_open":{"title":"Åben Midlertidigt"},"auto_reopen":{"title":"Åben Automatisk Emnet"},"temp_close":{"title":"Luk Midlertidigt"},"auto_close":{"title":"Luk Automatisk Emnet","label":"Auto-luk emne, timer:","error":"Indtast venligst en gyldig værdi.","based_on_last_post":"Luk ikke før det seneste indlæg i emnet er mindst så gammel."},"auto_delete":{"title":"Slet emne automatisk"},"auto_bump":{"title":"Auto-'bump' emne"},"reminder":{"title":"Påmind mig"},"status_update_notice":{"auto_open":"Emnet åbner automatisk %{timeLeft}.","auto_close":"Emnet lukker automatisk %{timeLeft}.","auto_publish_to_category":"Emnet vil blive udgivet i \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e %{timeLeft}.","auto_close_based_on_last_post":"Emnet vil lukke %{duration} efter det sidste svar.","auto_delete":"Dette emne slettes automatisk %{timeLeft}.","auto_bump":"Dette emne bliver automatisk 'bumped' %{timeLeft}.","auto_reminder":"Du vil blive mindet om dette emne %{timeLeft}."},"auto_close_title":"Indstillinger for automatisk lukning","auto_close_immediate":{"one":"Seneste indlæg i emnet er allerede %{count} time gammelt så emnet bliver lukket med det samme.","other":"Seneste indlæg i emnet er allerede %{hours} timer gammelt så emnet bliver lukket med det samme."},"timeline":{"back":"Tilbage","back_description":"Tilbage til dit seneste ulæste indlæg","replies_short":"%{current} / %{total}"},"progress":{"title":"emnestatus","go_top":"top","go_bottom":"bund","go":"start","jump_bottom":"Hop til sidste indlæg","jump_prompt":"spring til...","jump_prompt_of":"af %{count} indlæg","jump_prompt_long":"Hop til...","jump_bottom_with_number":"hop til indlæg %{post_number}","jump_prompt_to_date":"til dato","jump_prompt_or":"eller","total":"antal indlæg","current":"nuværende indlæg"},"notifications":{"title":"skift hvor ofte du vil blive notificeret om dette emne","reasons":{"mailing_list_mode":"Du har maillist mode slået til, så du bliver notificeret omkring svar på dette emne via e-mail","3_10":"Du får notifikationer fordi du overvåger et tag på dette emne","3_6":"Du får notifikationer fordi du overvåger denne kategori.","3_5":"Du får notifikationer fordi du overvåger dette emne automatisk.","3_2":"Du får notifikationer fordi du overvåger dette emne.","3_1":"Du får notifikationer fordi du oprettede dette emne.","3":"Du får notifikationer fordi du overvåger dette emne.","2_8":"Du vil se antallet af nye svar, fordi du følger denne kategori.","2_4":"Du vil se antallet af nye svar, fordi du indsendte et svar for dette emne.","2_2":"Du vil se antallet af nye svar, fordi du følger dette emne.","2":"Du vil se antallet af nye svar, fordi du \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003elæste dette emne\u003c/a\u003e.","1_2":"Du vil modtage en notifikation hvis nogen nævner dit @name eller svarer dig.","1":"Du vil modtage en notifikation hvis nogen nævner dit @name eller svarer dig.","0_7":"Du ignorerer alle notifikationer i denne kategori.","0_2":"Du får ingen notifikationer for dette emne.","0":"Du får ingen notifikationer for dette emne."},"watching_pm":{"title":"Følger","description":"Du vil modtage en notifikation for hvert nyt svar i denne besked, og en optælling af nye svar vil blive vist."},"watching":{"title":"Overvåger","description":"Du vil modtage en notifikation for hvert nyt svar i denne tråd, og en optælling af nye svar vil blive vist."},"tracking_pm":{"title":"Følger","description":"En optælling af nye svar vil blive vist for denne besked. Du vil modtage en notifikation, hvis nogen nævner dit @name eller svarer dig."},"tracking":{"title":"Følger","description":"En optælling af nye svar vil blive vist for denne tråd. Du vil modtage en notifikation, hvis nogen nævner dit @name eller svarer dig."},"regular":{"title":"Normal","description":"Du vil modtage en notifikation, hvis nogen nævner dit @name eller svarer dig."},"regular_pm":{"title":"Normal","description":"Du vil modtage en notifikation, hvis nogen nævner dit @name eller svarer dig."},"muted_pm":{"title":"Lydløs","description":"Du vil aldrig få notifikationer om denne besked."},"muted":{"title":"Stille!","description":"Du vil aldrig få beskeder om noget i indlæggene og de vil ikke vises i seneste."}},"actions":{"title":"Handlinger","recover":"Gendan emne","delete":"Slet emne","open":"Åbn emne","close":"Luk emne","multi_select":"Vælg indlæg...","timed_update":"Indstil timerfunktion for emne...","pin":"Fastgør Emne...","unpin":"Fjern fastgøring af Emne...","unarchive":"Gendan emne fra arkiv","archive":"Arkivér emne","invisible":"Gør ulistet","visible":"Går listet","reset_read":"Glem hvilke emner jeg har læst","make_public":"Gør til offentligt emne","make_private":"Lav privat besked","reset_bump_date":"Nulstil 'Bump' Dato"},"feature":{"pin":"Fastgør Emne","unpin":"Fjern Fastgøring af Emne","pin_globally":"Fastgør emne globalt","make_banner":"Gør emnet til en banner","remove_banner":"Emnet skal ikke være banner længere"},"reply":{"title":"Svar","help":"start på et svar til dette emne"},"clear_pin":{"title":"Fjern tegnestift","help":"Fjern tegnestiften på dette emne så det ikke længere vises i toppen af emnelisten"},"share":{"title":"Del","extended_title":"Del et link","help":"del et link til dette emne"},"print":{"title":"Print","help":"Åben en printervenlig udgave at emnet"},"flag_topic":{"title":"Rapportér indlæg","help":"gør moderator opmærksom på dette indlæg","success_message":"Du har nu rapporteret dette emne til administrator."},"make_public":{"title":"Konverter til offentligt emne","choose_category":"Vælg en kategori til det offentlige emne:"},"feature_topic":{"title":"Fremhæv dette emne","pin":"Fastgør dette emne til toppen af kategorien {{categoryLink}} indtil","confirm_pin":"Du har allerede {{count}} fastgjorte emner. Fastgjorte emner kan være irriterende for nye og anonyme brugere. Er du sikker på du vil fastgøre et nyt emne i denne kategori?","unpin":"Fjern dette emne fra starten af listen i {{categoryLink}} kategorien.","unpin_until":"Fjern dette emne fra toppen af kategorien {{categoryLink}} eller vent til \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Brugere kan unpinne emnet individuelt.","pin_validation":"Der skal angives en dato for at fastgøre dette emne","not_pinned":"Der er ingen fastgjorte emner i {{categoryLink}}.","already_pinned":{"one":"Emner fastgjort i {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Emner fastgjort i {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Fastgør dette emne til toppen af alle emnelister indtil","confirm_pin_globally":"Du har allerede {{count}} globalt fastgjorte emner. For mange fastgjorte emner kan være irriterende for nye og anonyme brugere. Er du sikker på du vil fastgøre et emne mere globalt?","unpin_globally":"Fjern dette emne fra toppen af alle emne lister.","unpin_globally_until":"Fjern dette emne fra toppen af alle emnelister eller vent til \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Brugere kan unpinne emnet individuelt.","not_pinned_globally":"Der er ingen globalt fastgjorte emner.","already_pinned_globally":{"one":"Globalt fastgjorte emner: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Globalt fastgjorte emner: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Gør dette emne til en banner, der kommer til at stå i toppen på alle sider.","remove_banner":"Fjern banneret, der står på toppen af alle sider.","banner_note":"Brugere kan fjernet banneret ved at lukke det. Kun én banner kan være aktiv ad gangen.","no_banner_exists":"Der er ikke noget banner-emne.","banner_exists":"Der \u003cstrong class='badge badge-notification unread'\u003eer\u003c/strong\u003e aktuelt et banner-emne."},"inviting":"Inviterer…","automatically_add_to_groups":"Denne invitation inkluderer også adgang til disse groupper:","invite_private":{"title":"Inviter til besked","email_or_username":"Inviteret brugers e-mail eller brugernavn","email_or_username_placeholder":"e-mail-adresse eller brugernavn","action":"Invitér","success":"Vi har inviteret denne bruger til at være med i denne besked.","success_group":"We har inviteret denne gruppe til at deltage i denne besked","error":"Beklager, der skete en fejl, da vi forsøgte at invitere brugeren.","group_name":"gruppe navn"},"controls":"Vælg handling","invite_reply":{"title":"Invitér","username_placeholder":"brugernavn","action":"Send invitation","help":"inviter andre til dette emne via email eller notifikationer","to_forum":"Vi sender din ven en kort e-mail, som gør det muligt at tilmelde sig øjeblikkeligt ved at klikke på et link, uden det er nødvendigt at logge ind.","sso_enabled":"Indtast brugernavnet på den person, du gerne vil invitere til dette emne.","to_topic_blank":"Indtast brugernavnet eller en email adresse på den person, du gerne vil invitere til dette emne.","to_topic_email":"Du har indtastet en email adresse. Vi vil sende en e-mail invitation, der giver din ven direkte adgang til at svare på dette emne.","to_topic_username":"Du har indtastet et brugernavn. Vi sender en notifikation med en invitation til denne tråd.","to_username":"Indtast brugernavnet på den person du vil invitere. Vi sender en notifikation med et link til denne tråd.","email_placeholder":"e-mail-adresse","success_email":"Vi har e-mailet en invitation til \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Vi notificerer dig, når invitationen er blevet accepteret. Kig på invitations fanebladet på din bruger side for at se status på dine invitationer.","success_username":"Vi har inviteret brugeren til at deltage i dette emne.","error":"Beklager, vi kunne ikke invitere denne person. Måske er de allerede inviteret? (der er begrænsning på hvor mange gange man kan invitere en person)","success_existing_email":"En bruger med email \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e eksisterer allerede. Vi har opfordret denne bruger til at deltage i dette emne."},"login_reply":"Log ind for at svare","filters":{"n_posts":{"one":"%{count} indlæg","other":"{{count}} indlæg"},"cancel":"Fjern filter"},"move_to":{"title":"Flyt til","action":"flyt til","error":"Der opstod en fejl ved flytning af indlæg."},"split_topic":{"title":"Flyt til nyt emne","action":"flyt til nyt emne","topic_name":"Ny emne titel","radio_label":"Nyt emne","error":"Der opstod en fejl under flytningen af indlæg til det nye emne.","instructions":{"one":"Du er ved at oprette et nyt emne med det valgte indlæg.","other":"Du er ved at oprette et nyt emne med de \u003cb\u003e{{count}}\u003c/b\u003e valgte indlæg."}},"merge_topic":{"title":"Flyt til eksisterende emne","action":"flyt til eksisterende emne","error":"Der opstod en fejl under flytningen af indlæg til emnet.","radio_label":"Eksisterende emne","instructions":{"one":"Vælg venligst det emne som indlægget skal flyttes til.","other":"Vælg venligst det emne som de \u003cb\u003e{{count}}\u003c/b\u003e indlæg skal flyttes til."}},"move_to_new_message":{"title":"Flyt til ny besked","action":"flyt til ny besked","message_title":"Ny besked titel","radio_label":"Ny Besked","participants":"Deltagere","instructions":{"one":"Du er ved at oprette en ny besked og udfylde den med indlægget, du har valgt.","other":"Du er ved at oprette en ny besked og udfylde den med de \u003cb\u003e{{count}}\u003c/b\u003e- indlæg, du har valgt."}},"move_to_existing_message":{"title":"Flyt til Eksisterende Besked","action":"flyt til eksisterende besked","radio_label":"Eksisterende Besked","participants":"Deltagere","instructions":{"one":"Vælg beskeden, du gerne vil flytte dette indlæg til.","other":"Vælg beskeden, du gerne vil flytte disse \u003cb\u003e{{count}}-\u003c/b\u003e indlæg til."}},"merge_posts":{"title":"Flet valgte indlæg","action":"flet valgte indlæg","error":"Der opstod en fejl med at flette de valgte indlæg."},"change_owner":{"title":"Skift ejer","action":"skift ejerskab","error":"Der opstod en fejl da ejerskabet skulle skiftes.","placeholder":"brugernavn på ny ejer","instructions":{"one":"Vælg en ny ejer til indlægget af \u003cb\u003e@ {{old_user}}\u003c/b\u003e","other":"Vælg en ny ejer til {{count}}indlæg af \u003cb\u003e@ {{old_user}}\u003c/b\u003e"}},"change_timestamp":{"title":"Tilpas tidsstempel...","action":"ret tidsstempel","invalid_timestamp":"Tidsstempel kan ikke være i fremtiden","error":"Der opstod en fejl under rettelsen af tidsstemplet for dette emne.","instructions":"Vælg venligst det nye tidsstempel for dette emne. Indlæg under emnet vil blive opdateret så de har samme tidsforskel."},"multi_select":{"select":"vælg","selected":"valgt ({{count}})","select_post":{"label":"vælg","title":"Tilføj indlæg til udvalg"},"selected_post":{"label":"valgte","title":"Klik for at fjerne indlæg fra udvalg"},"select_replies":{"label":"vælg +svar","title":"Tilføj indlæg og alle dets svar til udvalg"},"select_below":{"label":"vælg + nedenfor","title":"Tilføj indlæg og alt efter det til udvalg"},"delete":"slet valgte","cancel":"glem valg","select_all":"marker alle","deselect_all":"marker ingen","description":{"one":"Du har valgt \u003cb\u003e%{count}\u003c/b\u003e indlæg.","other":"Du har valgt \u003cb\u003e{{count}}\u003c/b\u003e indlæg."}},"deleted_by_author":{"one":"(emne, der trækkes tilbage af forfatteren, slettes automatisk efter%{count} time, medmindre det markeres)","other":"(emne, der trækkes tilbage af forfatteren, slettes automatisk efter %{count} timer, medmindre det markeres)"}},"post":{"quote_reply":"Citér","edit_reason":"Reason: ","post_number":"indlæg {{number}}","ignored":"Ignoreret indhold","wiki_last_edited_on":"wiki sidst redigeret den","last_edited_on":"indlæg sidst redigeret den","reply_as_new_topic":"Svar som linket emne","reply_as_new_private_message":"Svar med ny besked til de samme modtagere","continue_discussion":"Fortsætter debatten fra {{postLink}}:","follow_quote":"gå til det citerede indlæg","show_full":"Vis hele emnet","show_hidden":"Vis ignoreret indhold.","deleted_by_author":{"one":"(indlæg trukket tilbage af forfatteren, slettes automatisk om %{count} time med mindre det bliver flaget)","other":"(indlæg trukket tilbage af forfatteren, slettes automatisk om %{count} timer med mindre det bliver flaget)"},"collapse":"fald sammen","expand_collapse":"fold ud/ind","locked":"Et hjælperteam medlem har låst dette indlæg fra at blive redigeret","gap":{"one":"se %{count} udeladt indlæg ","other":"se {{count}} udeladte indlæg "},"notice":{"new_user":"Dette er første gang {{user}} har sendt - lad os byde dem velkommen til vores fællesskab!","returning_user":"Det er et stykke tid siden vi har set {{user}} - deres sidste indlæg var {{time}}."},"unread":"Indlæg er ulæst","has_replies":{"one":"{{count}} svar","other":"{{count}} svar"},"has_likes_title":{"one":"%{count} likede dette indlæg","other":"{{count}} likede dette indlæg"},"has_likes_title_only_you":"du likede dette indlæg","has_likes_title_you":{"one":"du og %{count} anden likede dette indlæg","other":"du og {{count}} andre likede dette indlæg"},"errors":{"create":"Beklager, der opstod en fejl under oprettelsen af dit indlæg. Prøv venligst igen.","edit":"Beklager, der opstrod en fejl under redigeringen af dit indlæg. Prøv venligst igen.","upload":"Beklager, der opstod en fejl ved upload af filen. Prøv venligst igen.","file_too_large":"Beklager, denne fil er for stor (maksimal størrelse er {{max_size_kb}}kb). Hvorfor ikke uploade din store fil til en cloud-delingstjeneste, og derefter indsætte linket?","too_many_uploads":"Beklager, men du kan kun uploade én fil ad gangen.","too_many_dragged_and_dropped_files":"Beklager, du kan kun uploade {{max}} filer ad gangen.","upload_not_authorized":"Beklager, filen som du forsøger at uploade, er ikke tiladt (tilladte filendelser: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Beklager, nye brugere kan ikke uploade billeder.","attachment_upload_not_allowed_for_new_user":"Beklager, nye brugere kan ikke uploade vedhæftede filer.","attachment_download_requires_login":"Beklager, du skal være logget på for at downloade vedhæftede filer."},"abandon_edit":{"no_value":"Nej, behold","no_save_draft":"Nej, gem kladde"},"abandon":{"confirm":"Er du sikker på, at du vil droppe dit indlæg?","no_value":"Nej","no_save_draft":"Nej, gem kladde","yes_value":"Ja"},"via_email":"dette indlæg blev oprettet via email","via_auto_generated_email":"dette indlæg blev oprettet af en auto genereret e-mail","whisper":"dette indlæg er en privat hvisken for moderatorer","wiki":{"about":"indlægget er en wiki"},"archetypes":{"save":"Gem indstillinger"},"few_likes_left":"Tak fordi du liker! Du har kun få likes tilbage i dag.","controls":{"reply":"begynd at skrive et svar på dette indlæg","like":"like dette indlæg","has_liked":"Du liker dette indlæg","read_indicator":"medlemmer der har læst dette indlæg","undo_like":"fortryd like","edit":"redigér dette indlæg","edit_action":"Rediger","edit_anonymous":"Beklager, du skal være logget ind for at redigere dette indlæg.","flag":"gør moderator opmærksom på dette indlæg","delete":"slet dette indlæg","undelete":"annullér sletning","share":"del et link til dette indlæg","more":"Mere","delete_replies":{"confirm":"Vil du også slette svarene på dette indlæg?","direct_replies":{"one":"Ja, og %{count} direkte svar","other":"Ja, og {{count}} direkte svar"},"all_replies":{"one":"Ja, og %{count} svar","other":"Ja, og alle {{count}} svar"},"just_the_post":"Nej, kun dette indlæg"},"admin":"indlæg administrator handlinger","wiki":"Opret Wiki","unwiki":"Fjern Wiki","convert_to_moderator":"Tilføj Personale farve","revert_to_regular":"Fjern Personale farve","rebake":"Gendan HTML","unhide":"Vis","change_owner":"Skift ejerskab","grant_badge":"Tildel Badge","lock_post":"Lås Indlæg","lock_post_description":"forhindr senderen i at redigere dette indlæg","unlock_post":"Lås indlæg op","unlock_post_description":"tillad senderen at redigere dette indlæg","delete_topic_disallowed_modal":"Du har ikke tilladelse til at slette dette emne. Hvis du virkelig ønsker, at det skal være slettet, skal du indsende en markering for moderator opmærksomhed, samt inkludere en begrundelse. ","delete_topic_disallowed":"du har ikke tilladelse til at slette dette emne","delete_topic":"slet emne","add_post_notice":"Tilføj Hjælperteam Notits","remove_post_notice":"Fjern Hjælperteam Notits","remove_timer":"fjern timer"},"actions":{"flag":"Flag","defer_flags":{"one":"Ignorer flag","other":"Ignorér markeringer"},"undo":{"off_topic":"Undo flag","spam":"Undo flag","inappropriate":"Undo flag","bookmark":"Undo bookmark","like":"Undo like"},"people":{"off_topic":"markerede dette som off-topic","spam":"markerede dette som spam","inappropriate":"markerede dette som upassende","notify_moderators":"informerede moderatorer","notify_user":"sendte en besked","bookmark":"bogmærkede dette","like_capped":{"one":"og {{count}} anden kunne lide dette","other":"og {{count}} andre kunne lide dette"}},"by_you":{"off_topic":"Du flagede dette som off-topic","spam":"Du flagede dette som spam","inappropriate":"Du flagede dette som upassende","notify_moderators":"Du flagede dette til gennemsyn","notify_user":"Du har sendt en besked til denne bruger","bookmark":"Du bogmærkede dette indlæg","like":"Du liker dette indlæg"}},"delete":{"confirm":{"one":"Er du sikker på, at du vil slette dette indlæg?","other":"Er du sikker på, at du vil slette disse {{count}}indlæg?"}},"merge":{"confirm":{"one":"Er du sikker på, at du vil flette disse indlæg?","other":"Er du sikker på, at du vil flette disse {{count}}indlæg?"}},"revisions":{"controls":{"first":"Første udgave","previous":"Forrige udgave","next":"Næste udgave","last":"Sidste udgave","hide":"Skjul udgave","show":"Vis udgave","revert":"Gå tilbage til denne udgave","edit_wiki":"Ret Wiki","edit_post":"Ret Indlæg","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Vis det renderede output med tilføjelser og ændringer indlejret","button":"HTML"},"side_by_side":{"title":"Vis de renderede output-diffs ved siden af hinanden","button":"HTML"},"side_by_side_markdown":{"title":"Vis forskellen på den rå kildekode side om side","button":"Rå"}}},"raw_email":{"displays":{"raw":{"title":"Vis den rå e-mail","button":"Rå"},"text_part":{"title":"Vis tekstdelen af e-mailen...","button":"Tekst"},"html_part":{"title":"Vis html-delen af e-mailen","button":"HTML"}}},"bookmarks":{"created":"Oprettet","name":"Navn"}},"category":{"can":"kan\u0026hellip; ","none":"(ingen kategori)","all":"Alle kategorier","choose":"kategori\u0026hellip;","edit":"Rediger","edit_dialog_title":"Rediger: %{categoryName}","view":"Vis emner i kategori","general":"Overordnet","settings":"Indstillinger","topic_template":"Skabelon for emne","tags":"Tags","tags_allowed_tags":"Begræns disse tags til denne kategori:","tags_allowed_tag_groups":"Begræns disse tag grupper til denne kategori:","tags_placeholder":"(Valgfri) liste af tiladte mærker","tag_groups_placeholder":"(Valgfri) liste af tiladte mærke grupper","manage_tag_groups_link":"Administrer tag grupper her.","allow_global_tags_label":"Tillad også andre tags","topic_featured_link_allowed":"Tillad fremhævede links i denne kategori","delete":"Slet kategori","create":"Ny kategori","create_long":"Opret en ny kategori","save":"Gem kategori","slug":"Kategori simpelt navn","slug_placeholder":"(Valgfri) gennemstregede-ord for URL","creation_error":"Der opstod en fejl under oprettelsen af kategorien.","save_error":"Der opstod en fejl da kategorien skulle gemmes.","name":"Kategorinavn","description":"Beskrivelse","topic":"kategoriemne","logo":"Kategori logo billede","background_image":"Kategori logo baggrundsbillede","badge_colors":"Mærkefarver","background_color":"Baggrundsfarve","foreground_color":"Tekstfarve","name_placeholder":"Bør være kort og kontant.","color_placeholder":"En web-farve","delete_confirm":"Er du sikker på, at du vil slette den kategori?","delete_error":"Der opstod en fejl ved sletning af kategorien.","list":"Kategoriliste","no_description":"Der er ingen beskrivelse for denne kategori.","change_in_category_topic":"besøg kategoriemnet for at redigere beskrivelsen","already_used":"This color has been used by another category","security":"Sikkerhed","special_warning":"Advarsel: Denne kategori er forud-seedet og sikkerhedsindstillingerne kan ikke redigeres. Hvis du ikke ønsker at bruge denne kategori, bør du slette den snarere end at genbruge den til et andet formål.","uncategorized_security_warning":"Denne kategori er speciel. Det er beregnet som et opholdsområde for emner, der ikke har nogen kategori; denkan ikke have sikkerheds indstillinger.","uncategorized_general_warning":"Denne kategori er speciel. Den bruges som standard kategori for nye emner, der ikke har valgt en kategori. Hvis du vil forhindre denne opførsel og tvinge valg af kategori, \u003ca href=\"%{settingLink}\"\u003eskal du deaktivere indstillingen her\u003c/a\u003e . Hvis du vil ændre navn eller beskrivelse, skal du gå til \u003ca href=\"%{customizeLink}\"\u003eTilpas / tekst indhold\u003c/a\u003e .","images":"Billeder","email_in":"Brugerindstillet ingående email adresse:","email_in_allow_strangers":"Accepter emails fra ikke oprettede brugere","email_in_disabled":"Nye emner via email er deaktiveret i Site opsætning. For at aktivere oprettelse af nye emner via email,","email_in_disabled_click":"aktiver \"email ind\" indstilligen.","mailinglist_mirror":"Kategori spejler en mailing liste","show_subcategory_list":"Vis oversigt med subkategorier ovenover emner i denne kategori.","num_featured_topics":"Antal emner som skal vises på siden med kategorier:","subcategory_num_featured_topics":"Antal af fremhævede emner på siden for den overordnede kategori:","all_topics_wiki":"Opret nye emne wikier som standard ","subcategory_list_style":"Oversigtsform for subkategori","sort_order":"Emneoversigt - sortér efter:","default_view":"Standard emneoversigt:","default_top_period":"Standardperiode for top:","allow_badges_label":"Tillad af badges bliver tildelt i denne kategori","edit_permissions":"Redigér tilladelser","reviewable_by_group":"Foruden hjælperteam, kan indlæg og markeringer i denne kategori også gennemgås af:","review_group_name":"gruppe navn","require_topic_approval":"Kræv moderator godkendelse af alle nye emner","require_reply_approval":"Kræv moderator godkendelse af alle nye svar","this_year":"dette år","position":"Placering på kategorisiden:","default_position":"Standarposition","position_disabled":"Kategorier vil blive vist i rækkefølge efter aktivitet. For at styre rækkefølgen af kategorier i lister, ","position_disabled_click":"skal funktionen \"fikserede kategori positioner\" slås til.","minimum_required_tags":"Minimum antal tags krævet i et emne:","parent":"Overordnet kategori","num_auto_bump_daily":"Antal åbne emner, der automatisk 'bump'es dagligt:","navigate_to_first_post_after_read":"Navigér til det første indlæg, når emnerne er læst","notifications":{"watching":{"title":"Overvåger","description":"Du overvåger automatisk alle emner i disse kategorier. Du får besked om hvert nyt indlæg i hvert emne og antallet af nye svar bliver vist."},"watching_first_post":{"title":"Overvåger Første Indlæg","description":"Du vil blive underrettet om nye emner i denne kategori, men ikke svar på emnerne."},"tracking":{"title":"Følger","description":"Du tracker automatisk alle emner i disse kategorier. Du får besked hvis nogen nævner dit @navn eller svarer dig, og antallet af nye svar bliver vist."},"regular":{"title":"Normal","description":"Du vil modtage en notifikation, hvis nogen nævner dit @name eller svarer dig."},"muted":{"title":"Ignoreret","description":"Du vil aldrig få besked om noget om nye emner i kategorierne og de vises heller ikke i seneste."}},"search_priority":{"label":"Søgeprioritet","options":{"normal":"Normal","ignore":"Ignorér","very_low":"Meget lav","low":"Lav","high":"Høj","very_high":"Meget høj"}},"sort_options":{"default":"standard","likes":"Likes","op_likes":"\"Synes om\" for oprindeligt indlæg","views":"Visninger","posts":"Indlæg","activity":"Aktivitet","posters":"Forfattere","category":"Kategori","created":"Oprettet","votes":"Stemmer"},"sort_ascending":"Stigende","sort_descending":"Faldende","subcategory_list_styles":{"rows":"Rækker","rows_with_featured_topics":"Rækker med fremhævede emner","boxes":"Bokse","boxes_with_featured_topics":"Bokse med fremhævede emner"},"settings_sections":{"general":"Overordnet","moderation":"Moderation","appearance":"Udseende","email":"Email"}},"flagging":{"title":"Tak fordi du hjælper med at holde vores forum civiliseret!","action":"Flag indlæg","take_action":"Reagér","notify_action":"Besked","official_warning":"Officiel Advarsel","delete_spammer":"Slet spammer","yes_delete_spammer":"Ja, slet spammer","ip_address_missing":"(Ikke tilgængelig)","hidden_email_address":"(skjult)","submit_tooltip":"Send privat markeringen","take_action_tooltip":"Nå til markerings niveauer med det samme, i stedet for at vente på flere markeringer fra fælleskabet","cant":"Beklager, du kan i øjeblikket ikke flage dette indlæg.","notify_staff":"Informer staff privat","formatted_name":{"off_topic":"Det holder sig ikke til emnet","inappropriate":"Det er upassende","spam":"Det er spam"},"custom_placeholder_notify_user":"Vær præcis, vær kontruktiv og vær altid venlig.","custom_placeholder_notify_moderators":"Lad os vide præcis hvad du er bekymret over og giv relevante links og eksempler hvor det er muligt.","custom_message":{"at_least":{"one":"indtast mindst %{count} tegn","other":"indtast mindst {{count}} tegn"},"more":{"one":"%{count} mere...","other":"{{count}} mere..."},"left":{"one":"%{count} tilbage","other":"{{count}} tilbage"}}},"flagging_topic":{"title":"Tak fordi du hjælper med at holde vores forum civiliseret!","action":"Rapporter emne","notify_action":"Besked"},"topic_map":{"title":"Emne-resumé","participants_title":"Hyppige forfattere","links_title":"Populære Links","links_shown":"vis flere links...","clicks":{"one":"%{count} klik","other":"%{count} klik"}},"post_links":{"about":"udvid flere links for dette indlæg","title":{"one":"%{count} mere","other":"%{count} flere"}},"topic_statuses":{"warning":{"help":"Dette er en officiel advarsel."},"bookmarked":{"help":"Du har bogmærket dette emne"},"locked":{"help":"emnet er låst; det modtager ikke flere svar"},"archived":{"help":"emnet er arkiveret; det er frosset og kan ikke ændres"},"locked_and_archived":{"help":"Dette emne er lukket og arkiveret; der kan ikke længere postes nye indlæg, og emner kan ikke ændres."},"unpinned":{"title":"Ikke fastgjort","help":"Dette emne er ikke fastgjort for dig; det vil blive vist i den normale rækkefølge"},"pinned_globally":{"title":"Fastgjort globalt","help":"Dette emne er globalt fastgjort; det vises i toppen af seneste og i dets kategori"},"pinned":{"title":"Fastgjort","help":"Dette emne er fastgjort for dig; det vil blive vist i toppen af dets kategori"},"unlisted":{"help":"Dette emne er ulistet; det vil ikke blive vist i listen over emner og kan kun tilgås med et direkte link"},"personal_message":{"title":"Dette emne er en privat besked","help":"Dette emne er en privat besked"}},"posts":"Indlæg","posts_long":"{{number}} indlæg i dette emne","original_post":"Oprindeligt indlæg","views":"Visninger","views_lowercase":{"one":"visning","other":"visninger"},"replies":"Svar","views_long":{"one":"emnet er læst %{count} gang","other":"emnet er læst {{number}} gange"},"activity":"Aktivitet","likes":"Likes","likes_lowercase":{"one":"like","other":"likes"},"likes_long":"der er {{number}} likes i dette emne","users":"Deltagere","users_lowercase":{"one":"bruger","other":"brugere"},"category_title":"Kategori","history":"Historik","changed_by":"af {{author}}","raw_email":{"title":"Indgående e-mail","not_available":"Ikke tilgængelig!"},"categories_list":"Kategorioversigt","filters":{"with_topics":"%{filter} emner","with_category":"%{filter} %{category} emner","latest":{"title":"Seneste","title_with_count":{"one":"Seneste (%{count})","other":"Seneste ({{count}})"},"help":"de seneste emner"},"read":{"title":"Læste","help":"emner du har læst"},"categories":{"title":"Kategorier","title_in":"Kategori - {{categoryName}}","help":"alle emner grupperet efter kategori"},"unread":{"title":"Ulæst","title_with_count":{"one":"Ulæst (%{count})","other":"Ulæste ({{count}})"},"help":"emner du følger med i lige nu med ulæste indlæg","lower_title_with_count":{"one":"%{count} ulæst","other":"{{count}} ulæste"}},"new":{"lower_title_with_count":{"one":"%{count} ny","other":"{{count}} nye"},"lower_title":"Ny","title":"Nye","title_with_count":{"one":"Nye (%{count})","other":"Nye ({{count}})"},"help":"Emner oprettet i de seneste par dage"},"posted":{"title":"Mine indlæg","help":"emner du har skrevet indlæg i"},"bookmarks":{"title":"Bogmærker","help":"emner du har bogmærket"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (%{count})","other":"{{categoryName}} ({{count}})"},"help":"populære emner i kategorien {{categoryName}}"},"top":{"title":"Top","help":"de mest aktive emner i det sidse år, måned, uge og dag","all":{"title":"Alt"},"yearly":{"title":"Årligt"},"quarterly":{"title":"Kvartalvis"},"monthly":{"title":"Månedligt"},"weekly":{"title":"Ugentligt"},"daily":{"title":"Dagligt"},"all_time":"Alt","this_year":"År","this_quarter":"Kvartal","this_month":"Måned","this_week":"Uge","today":"I dag","other_periods":"se top"},"votes":{"title":"Stemmer","help":"emner med flest stemmer"}},"browser_update":"Desværre er \u003ca href=\"https://www.discourse.org/faq/#browser\"\u003edin browser for gammel til at virke på denne side\u003c/a\u003e . \u003ca href=\"https://browsehappy.com\"\u003eOpgrader din browser\u003c/a\u003e .","permission_types":{"full":"Opret / Besvar / Se","create_post":"Besvar / Se","readonly":"Se"},"lightbox":{"download":"download","previous":"Forrige (Venstre piletast)","next":"Næste (højre piletast)","counter":"%curr% af %total%","close":"Luk (Esc)","content_load_error":"\u003ca href=\"%url%\"\u003eIndholdet\u003c/a\u003e kunne ikke indlæses.","image_load_error":"\u003ca href=\"%url%\"\u003eBilledet\u003c/a\u003e kunne ikke indlæses."},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":", ","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1} eller %{shortcut2}","shortcut_delimiter_slash":"%{shortcut1} / %{shortcut2}","shortcut_delimiter_space":"%{shortcut1} %{shortcut2}","title":"Tastaturgenveje","jump_to":{"title":"Hop til","home":"%{shortcut} Hjem","latest":"%{shortcut} Seneste","new":"%{shortcut} Ny","unread":"%{shortcut} Ulæst","categories":"%{shortcut} Kategorier","top":"%{shortcut} Top","bookmarks":"%{shortcut} Bogmærker","profile":"%{shortcut} Profil","messages":"%{shortcut} Beskeder","drafts":"%{shortcut} Kladder"},"navigation":{"title":"Navigation","jump":"%{shortcut} Gå til indlæg #","back":"%{shortcut} Tilbage","up_down":"%{shortcut} Flyt udvalgte \u0026uarr; \u0026darr;","open":"%{shortcut} Åben det valgte emne","next_prev":"%{shortcut} Næste/Forrige","go_to_unread_post":"%{shortcut} Gå til det første ulæste indlæg"},"application":{"title":"Applikation","create":"%{shortcut} Opret nyt emne","notifications":"%{shortcut} Åben notifikationer","hamburger_menu":"%{shortcut} Åben hamburger menu","user_profile_menu":"%{shortcut} Åben bruger menu","show_incoming_updated_topics":"%{shortcut} Vis opdaterede emner","search":"%{shortcut} Søg","help":"%{shortcut} Åben tastaturhjælp","dismiss_new_posts":"%{shortcut} Afvis Nyt/Indlæg","dismiss_topics":"%{shortcut} Afvis emner","log_out":"%{shortcut} Log ud"},"composing":{"title":"Componerer","return":"%{shortcut} Tilbage til forfatter","fullscreen":"%{shortcut} Fullscreen composer"},"actions":{"title":"Handlinger","bookmark_topic":"%{shortcut} Slå bogmærk emne til/fra","pin_unpin_topic":"%{shortcut} Fastgør/Frigør emne","share_topic":"%{shortcut} Del emne","share_post":"%{shortcut} Del indlæg","reply_as_new_topic":"%{shortcut} Svar med et linket emne","reply_topic":"%{shortcut} Besvar emne","reply_post":"%{shortcut} Besvar indlæg","quote_post":"%{shortcut} Citer indlæg","like":"%{shortcut} Like indlæg","flag":"%{shortcut} Flag indlæg","bookmark":"%{shortcut} Bogmærk indlæg","edit":"%{shortcut} Redigér indlæg","delete":"%{shortcut} Slet indlæg","mark_muted":"Ignorer emnet","mark_regular":"%{shortcut} Almindeligt (standard) emne","mark_tracking":"%{shortcut} Følg emne","mark_watching":"%{shortcut} Hold øje med emne","print":"%{shortcut} Print emne","defer":"%{shortcut} Udsæt emne"}},"badges":{"earned_n_times":{"one":"Blev tildelt dette badge %{count} gang","other":"Blev tildelt dette badge %{count} gange"},"granted_on":"Tildelt %{date}","others_count":"Andre med dette badge (%{count})","title":"Badges","allow_title":"Du kan bruge denne badge som en titel","multiple_grant":"Du kan tjene dette flere gange","badge_count":{"one":"%{count} Badge","other":"%{count} Badges"},"more_badges":{"one":"+%{count} Mere","other":"+%{count} Flere"},"granted":{"one":"%{count} tildelt","other":"%{count} tildelt"},"select_badge_for_title":"Vælg en badge, du vil bruge som din titel","none":"(ingen)","successfully_granted":"Vellykket tildelt %{badge} til %{username}","badge_grouping":{"getting_started":{"name":"Sådan kommer du i gang"},"community":{"name":"Fællesskab"},"trust_level":{"name":"Tillidsniveau"},"other":{"name":"Andet"},"posting":{"name":"Sender"}}},"tagging":{"all_tags":"Alle tags","other_tags":"Andre tags","selector_all_tags":"alle tags","selector_no_tags":"ingen tags","changed":"tags skiftet:","tags":"Tags","choose_for_topic":"valgfri tags","add_synonyms":"Tilføj","delete_tag":"Slet tag","delete_confirm":{"one":"Er du sikker på, at du vil slette dette tag og fjerne det fra et emne %{count}, der er tildelt det?","other":"Er du sikker på, at du vil slette dette tag og fjerne det fra {{count}}emner, der er tildelt det?"},"delete_confirm_no_topics":"Er du sikker på, at du vil slette dette tag?","rename_tag":"Omdøb tag","rename_instructions":"Vælg et nyt navn for det tag:","sort_by":"Sortér efter:","sort_by_count":"antal","sort_by_name":"navn","manage_groups":"Håndtér tag grupper","manage_groups_description":"Definér grupper til at håndtere tags","upload":"upload tags","upload_description":"Upload en csv-fil for at oprette tags i bulk","upload_instructions":"Én pr. linje, eventuelt med en tag gruppe i formatet 'tagnavn, tag_gruppe'","upload_successful":"Vellykket upload af tags","delete_unused_confirmation":{"one":"%{count}tag vil blive slettet: %{tags}","other":"%{count} tags bliver slettet: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} og %{count} mere","other":"%{tags} og %{count} mere"},"delete_unused":"Slet ubrugte tags","delete_unused_description":"Slet alle tags, der ikke er knyttet til nogen emner eller personlige beskeder","cancel_delete_unused":"Afbryd","filters":{"without_category":"%{filter} %{tag} emner","with_category":"%{filter} %{tag} emner i %{category}","untagged_without_category":"%{filter} utagged emner","untagged_with_category":"%{filter} utaggede emner i %{category}"},"notifications":{"watching":{"title":"Overvåger","description":"Du vil automatisk se alle emner med dette tag. Du vil blive underrettet om alle nye indlæg og emner, plus antallet af ulæste og nye indlæg vises også ved siden af emnet."},"watching_first_post":{"title":"Overvåger første indlæg","description":"Du vil blive underrettet om nye emner i dette tag, men ikke svar på emnerne."},"tracking":{"title":"Følger","description":"Du sporer automatisk alle emner med dette tag. Et antal ulæste og nye indlæg vises ved siden af emnet."},"regular":{"title":"Almindeligt","description":"Du vil blive notificeret if nogen nævner dit You will be notified if someone mentions your @name or replies to your post."},"muted":{"title":"Lydløs","description":"Du vil ikke blive underrettet om noget om nye emner med dette tag, og de vises ikke på din ulæste fane."}},"groups":{"title":"Tag grupper","about":"Tilføj tags til grupper for nemmere håndtering.","new":"Ny gruppe","tags_label":"Tags i denne gruppe:","tags_placeholder":"tags","parent_tag_label":"Overordnede tag:","parent_tag_placeholder":"Valgfrit","parent_tag_description":"Tags fra denne gruppe kan ikke bruges medmindre det overordnede tag er tilstede.","one_per_topic_label":"Begræns ét tag per emne fra denne gruppe","new_name":"Ny tag gruppe","save":"Gem","delete":"Slet","confirm_delete":"Er du sikker du vil slette denne tag gruppe?","everyone_can_use":"Tags kan bruges af alle","usable_only_by_staff":"Tags er synlige for alle, men kun hjælperteam kan bruge dem","visible_only_to_staff":"Tags er kun synlige for hjælperteam"},"topics":{"none":{"unread":"Du har ingen ulæste emner.","new":"Du har ingen nye emner.","read":"Du har ikke læst nogen emner endnu.","posted":"Du har ikke oprettet nogen emner endnu.","latest":"Der er ikke nogen seneste emner.","bookmarks":"Du har ikke bogmærket nogen emner endnu.","top":"Der er ikke nogen populære emner."},"bottom":{"latest":"Der er ikke flere seneste emner.","posted":"Der er ikke flere oprettede emner.","read":"Der er ikke flere læste emner.","new":"Der er ikke flere nye emner.","unread":"Der er ikke flere ulæste emner.","top":"Der er ikke flere populære emner.","bookmarks":"Der er ikke flere bogmærkede emner."}}},"invite":{"custom_message":"Gør din invitation lidt mere personlig ved at skrive en \u003ca href\u003ebrugerdefineret besked\u003c/a\u003e .","custom_message_placeholder":"Skriv en personlig besked","custom_message_template_forum":"Hej, du burde tilmelde dig dette forum!","custom_message_template_topic":"Hej, jeg tænkte du måske ville synes om dette emne!"},"forced_anonymous":"På grund af ekstrem belastning vises dette midlertidigt for alle, da en logget ud bruger bruger også ville se det.","safe_mode":{"enabled":"Sikker tilstand er slået til - for at forlade sikker tilstand, så luk dette browservindue"},"poll":{"voters":{"one":"vælger","other":"vælgere"},"total_votes":{"one":"afgiven stemme","other":"afgivne stemmer"},"average_rating":"Gennemsnitlig rating: \u003cstrong\u003e%{average}\u003c/strong\u003e.","multiple":{"help":{"at_least_min_options":{"one":"Vælg mindst \u003cstrong\u003e%{count}\u003c/strong\u003e mulighed","other":"Vælg mindst \u003cstrong\u003e%{count}\u003c/strong\u003e muligheder"},"up_to_max_options":{"one":"Vælg op til \u003cstrong\u003e%{count}\u003c/strong\u003e mulighed","other":"Vælg op til \u003cstrong\u003e%{count}\u003c/strong\u003e muligheder"},"x_options":{"one":"Vælg \u003cstrong\u003e%{count}\u003c/strong\u003e mulighed","other":"Vælg \u003cstrong\u003e%{count}\u003c/strong\u003e muligheder"},"between_min_and_max_options":"Vælg imellem \u003cstrong\u003e%{min}\u003c/strong\u003e og \u003cstrong\u003e%{max}\u003c/strong\u003e valgmuligheder"}},"cast-votes":{"title":"Afgiv dine stemmer","label":"Stem nu!"},"show-results":{"title":"Vis afstemningsresultat","label":"Vis resultat"},"hide-results":{"title":"Tilbage til dine stemmer"},"export-results":{"label":"Eksporter"},"open":{"title":"Åbn afstemningen","label":"Åbn","confirm":"Er du sikker på, at du vil åbne denne afstemning?"},"close":{"title":"Luk afstemningen","label":"Luk","confirm":"Er du sikker på, at du vil lukke denne afstemning?"},"error_while_toggling_status":"Undskyld, der var en fejl i skifte status på denne afstemning.","error_while_casting_votes":"Undskyld, der var en fejl i din stemmeafgivning.","error_while_fetching_voters":"Beklager, der opstod en fejl med at vise deltagerne.","ui_builder":{"title":"Opret afstemning","insert":"Indsæt afstemning","help":{"invalid_values":"Minimumsværdien skal være mindre end maksimumværdien."},"poll_type":{"label":"Type","regular":"Enkelt valg","multiple":"Flere valg","number":"Nummerbedømmelse"},"poll_result":{"label":"Resultater"},"poll_config":{"max":"Maks","min":"Min","step":"Trin"},"poll_public":{"label":"Vis hvem der stemte"},"poll_options":{"label":"Indtast en valgmulighed per linje"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Påbegynd 'ny bruger' vejledningen for alle nye brugere","welcome_message":"Send en velkomsts besked til alle nye brugere med en opstartsguide"}},"discourse_local_dates":{"relative_dates":{"today":"I dag %{time}","tomorrow":"I morgen %{time}","yesterday":"I går %{time}"},"title":"Indsæt dato / tid","create":{"form":{"insert":"Indsæt","advanced_mode":"Avanceret tilstand","simple_mode":"Enkel tilstand","format_description":"Format, der bruges til at vise datoen til brugeren. Brug \"\\T\\Z\" til at vise brugerens tidszone i ord (Europa / Paris)","timezones_title":"Tidszoner, der skal vises","timezones_description":"Tidszoner vil blive brugt til at vise datoer i forhåndsvisning og fallback.","recurring_title":"Tilbagevenden","recurring_description":"Definer gentagelsen af en begivenhed. Du kan også manuelt redigere den tilbagevendende mulighed genereret af formularen og bruge en af følgende nøgler: år, kvartaler, måneder, uger, dage, timer, minutter, sekunder, millisekunder.","recurring_none":"Ingen gentagelse","invalid_date":"Ugyldig dato, sørg for, at dato og klokkeslæt er korrekte","date_title":"Dato","time_title":"Tidspunkt","format_title":"Datoformat","timezone":"Tidszone","until":"Indtil...","recurring":{"every_day":"Hver dag","every_week":"Hver uge","every_two_weeks":"Hver anden uge","every_month":"Hver måned","every_two_months":"Hver anden måned","every_three_months":"Hver tredje måned","every_six_months":"Hvert halvår","every_year":"Hvert år"}}}},"details":{"title":"Skjul detaljer"},"presence":{"replying":"svarer","editing":"redigerer","replying_to_topic":{"one":"svar","other":"svarer"}},"voting":{"title":"Stemmer","reached_limit":"Du kan ikke afgive flere stemmer, fjern venligst en og prøv igen!","list_votes":"Vis dine stemmer","votes_nav_help":"emner med flest stemmer","voted":"Du stemte i dette emne","allow_topic_voting":"Tillad brugere at stemme på emner i denne kategori","vote_title":"Stem","vote_title_plural":"Stemmer","voted_title":"Stemte","voting_closed_title":"Lukket","voting_limit":"Begrænset","votes_left":{"one":"Du har {{count}} stemme tilbage, se \u003ca href='{{path}}'\u003edine stemmer\u003c/a\u003e .","other":"Du har {{count}} stemmer tilbage, se \u003ca href='{{path}}'\u003edine stemmer\u003c/a\u003e ."},"votes":{"one":"{{count}} stemme","other":"{{count}} stemmer"},"anonymous_button":{"one":"Stemme","other":"Stemmer"},"remove_vote":"Fjern stemme"},"adplugin":{"advertisement_label":"REKLAME"},"docker":{"upgrade":"Din Discourse-installation er forældet.","perform_upgrade":"Klik her for at opgradere."}}},"zh_CN":{"js":{"dates":{"time_short_day":"ddd, HH:mm","long_no_year":"M[月]D[日] HH:mm"},"action_codes":{"forwarded":"转发上述邮件"},"topic_admin_menu":"管理主题","bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","created_with_at_desktop_reminder":"你所收藏的此帖将会在你下次使用桌面设备时被提醒。","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","no_timezone":"你尚未设置时区。您将无法设置提醒。在 \u003ca href=\"%{basePath}/my/preferences/profile\"\u003e你的个人资料中\u003c/a\u003e设置。","invalid_custom_datetime":"你所提供的日期和时间无效，请重试。","list_permission_denied":"你没有权限查看该用户的收藏。","reminders":{"at_desktop":"下次我使用桌面设备时","next_business_day":"下一个工作日","start_of_next_business_week":"下周一","last_custom":"最近","none":"无需提醒","today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"pwa":{"install_banner":"你想要\u003ca href\u003e安装%{title}在此设备上吗？\u003c/a\u003e"},"review":{"user":{"bio":"简介","website":"网站"}},"directory":{"last_updated":"最近更新："},"groups":{"requests":{"handle":"处理成员请求"},"allow_membership_requests":"允许用户向群组所有者发送成员资格请求（需要公开可见的群组）"},"user":{"feature_topic_on_profile":{"clear":{"warning":"你确定要清除精选主题吗？"}},"use_current_timezone":"使用现在的时区","featured_topic":"精选主题","staff_counters":{"rejected_posts":"被驳回的帖子"},"second_factor":{"totp":{"name_and_code_required_error":"你必须提供你的身份验证器应用的名称和代码。"},"security_key":{"default_name":"主要安全密钥","not_allowed_error":"安全密钥注册过程已超时或被取消。","already_added_error":"你已注册此安全密钥，无需再次注册。","edit":"编辑安全密钥","edit_description":"安全密钥名称","name_required_error":"你必须提供安全密钥的名称。"}},"change_avatar":{"gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e，基于","gravatar_title":"在{{gravatarName}}网站修改你的头像","gravatar_failed":"我们无法找到此电子邮件的{{gravatarName}}。","refresh_gravatar_title":"刷新你的{{gravatarName}}"},"change_profile_background":{"title":"个人档头部","instructions":"个人资料的页头会被居中显示且默认宽度为1110px。"},"change_featured_topic":{"title":"精选主题","instructions":"此主题的链接会显示在你的用户卡片和资料中。"},"invite_code":{"title":"邀请码","instructions":"账户注册需要邀请码"},"invited":{"sent":"上次发送"}},"modal":{"dismiss_error":"忽略错误"},"forgot_password":{"complete_username_found":"我们找到一个与用户名\u003cb\u003e%{username}\u003c/b\u003e匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。","complete_email_found":"我们找到一个与\u003cb\u003e%{email}\u003c/b\u003e相匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。"},"login":{"second_factor_backup":"使用备用码登录","second_factor":"使用身份验证器app登录","security_key_description":"当你准备好物理安全密钥后，请按下面的“使用安全密钥进行身份验证”按钮。","security_key_alternative":"尝试另一种方式","security_key_authenticate":"使用安全密钥进行身份验证","security_key_not_allowed_error":"安全密钥验证超时或被取消。","security_key_no_matching_credential_error":"在提供的安全密钥中找不到匹配的凭据。","security_key_support_missing_error":"您当前的设备或浏览器不支持使用安全密钥。请使用其他方法。","second_factor_toggle":{"totp":"改用身份验证APP","backup_code":"使用备份码"}},"emoji_set":{"emoji_one":"JoyPixels （曾用名EmojiOne）"},"select_kit":{"invalid_selection_length":"选择的字符至少为{{count}}个字符。"},"composer":{"error":{"topic_template_not_modified":"请通过编辑主题模板来为主题添加详情。"},"saved_draft":"正在发布草稿。点击以继续。","link_url_placeholder":"粘贴 URL 或键入以搜索主题","composer_actions":{"reply_as_new_topic":{"confirm":"您保存了新的主题草稿，如果您创建链接主题该草稿将被覆盖。"}}},"notifications":{"tooltip":{"high_priority":{"other":"%{count}个未读的高优先级通知"}},"membership_request_accepted":"接受来自“{{group_name}}”的邀请","membership_request_consolidated":"{{count}}个加入“{{group_name}}”群组的请求","titles":{"bookmark_reminder":"收藏提醒","bookmark_reminder_with_name":"收藏提醒 - %{name}","membership_request_consolidated":"新的成员申请"}},"search":{"context":{"tag":"搜索＃{{tag}}标签"},"advanced":{"filters":{"created":"我创建的"},"statuses":{"public":"是公开的"}}},"topic":{"feature_on_profile":{"help":"添加此主题的链接到你的用户卡片和资料中。","title":"精选到个人资料"},"remove_from_profile":{"warning":"你的个人资料中已存在精选主题。如果继续，此主题会替换存在的主题。","help":"在你的个人资料中移除指向该主题的链接","title":"从个人资料中移除"},"unread_indicator":"还没有成员读过此主题的最新帖子。","topic_status_update":{"num_of_days":"天数"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}}},"post":{"abandon_edit":{"confirm":"您确定要放弃所做的更改吗？","yes_value":"是的，忽略编辑"},"actions":{"people":{"like":{"other":"点赞"},"read":{"other":"看过"},"read_capped":{"other":"还有{{count}}个其他用户看过"}}},"bookmarks":{"create":"创建收藏夹","edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"delete_bookmark":{"name":"删除收藏","description":"从你的个人资料中删除收藏并停止所有有关该收藏的提醒"},"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"category":{"tags_tab_description":"上面所指定的标签和标签组仅在此分类以及其它也指定了它们的分类中可用。它们将无法在其它分类中使用。","tag_group_selector_placeholder":"（可选）标签组","required_tag_group_description":"要求新主题包含标签组中的标签：","min_tags_from_required_group_label":"标签数量：","required_tag_group_label":"标签组：","pending_permission_change_alert":"你还没有添加%{group}到此分类；点击此按钮添加。"},"keyboard_shortcuts_help":{"bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"actions":{"topic_admin_actions":"%{shortcut}打开主题管理"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}},"tagging":{"info":"详情","default_info":"该标签不限于任何类别，并且没有同义词。","category_restricted":"此标签仅限于你无权访问的分类。","synonyms":"同义词","synonyms_description":"使用以下标签时，它们将被替换为\u003cb\u003e%{base_tag_name}\u003c/b\u003e 。","tag_groups_info":{"other":"此标签属于这些标签组：{{tag_groups}}。"},"category_restrictions":{"other":"只能在这些分类中使用："},"edit_synonyms":"管理同义词","add_synonyms_label":"添加同义词：","add_synonyms_explanation":{"other":"当前任何使用了此标签的地方都将被改为使用\u003cb\u003e%{tag_name}\u003c/b\u003e代替。你确定要应用此更改吗？"},"add_synonyms_failed":"不能将以下标记添加为同义词： \u003cb\u003e%{tag_names}\u003c/b\u003e 。确保它们没有同义词并且不是其他标签的同义词。","remove_synonym":"删除同义词","delete_synonym_confirm":"您确定要删除同义词“ %{tag_name}”吗？","delete_confirm_synonyms":{"other":"其{{count}}个同义词也将被删除。"},"groups":{"name_placeholder":"标签组名称"}},"poll":{"public":{"title":"投票为\u003cstrong\u003e公开\u003c/strong\u003e。"},"results":{"groups":{"title":"你需要成为 %{groups} 的一员才能投票。"},"vote":{"title":"结果将显示在\u003cstrong\u003e投票\u003c/strong\u003e上。"},"closed":{"title":"结果将显示一次\u003cstrong\u003e关闭\u003c/strong\u003e。"},"staff":{"title":"结果仅显示给\u003cstrong\u003e管理\u003c/strong\u003e成员。"}},"hide-results":{"label":"显示投票"},"group-results":{"title":"按用户字段分组投票","label":"显示错误"},"ungroup-results":{"title":"合并所有投票","label":"隐藏错误"},"export-results":{"title":"到处投票结果"},"automatic_close":{"closes_in":"于\u003cstrong\u003e%{timeLeft}\u003c/strong\u003e关闭。","age":"\u003cstrong\u003e%{age}\u003c/strong\u003e关闭"},"error_while_exporting_results":"抱歉，导出投票结果时出错。","ui_builder":{"help":{"options_count":"至少输入1个选项","min_step_value":"最小步长为1"},"poll_result":{"always":"总是可见","vote":"投票","closed":"关闭时","staff":"仅管理人员"},"poll_groups":{"label":"允许的群组"},"poll_chart_type":{"label":"图表类型"},"automatic_close":{"label":"自动关闭投票"}}},"discourse_local_dates":{"relative_dates":{"countdown":{"passed":"日期已过"}}}}},"en":{"js":{"user":{"change_password":{"emoji":"lock emoji"}},"local_time":"Local Time","email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"notifications":{"tooltip":{"high_priority":{"one":"%{count} unread high priority notification"}}},"topic":{"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions_without_old_user":{"one":"Please choose a new owner for the post"}}},"post":{"controls":{"publish_page":"Page Publishing"},"actions":{"people":{"like":{"one":"liked this"},"read":{"one":"read this"},"read_capped":{"one":"and {{count}} other read this"}}}},"tagging":{"tag_groups_info":{"one":"This tag belongs to the group \"{{tag_groups}}\"."},"category_restrictions":{"one":"It can only be used in this category:"},"add_synonyms_explanation":{"one":"Any place that currently uses this tag will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?"},"delete_confirm_synonyms":{"one":"Its synonym will also be deleted."}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'da';
I18n.pluralizationRules.da = MessageFormat.locale.da;
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


    var da = moment.defineLocale('da', {
        months : 'januar_februar_marts_april_maj_juni_juli_august_september_oktober_november_december'.split('_'),
        monthsShort : 'jan_feb_mar_apr_maj_jun_jul_aug_sep_okt_nov_dec'.split('_'),
        weekdays : 'søndag_mandag_tirsdag_onsdag_torsdag_fredag_lørdag'.split('_'),
        weekdaysShort : 'søn_man_tir_ons_tor_fre_lør'.split('_'),
        weekdaysMin : 'sø_ma_ti_on_to_fr_lø'.split('_'),
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD.MM.YYYY',
            LL : 'D. MMMM YYYY',
            LLL : 'D. MMMM YYYY HH:mm',
            LLLL : 'dddd [d.] D. MMMM YYYY [kl.] HH:mm'
        },
        calendar : {
            sameDay : '[i dag kl.] LT',
            nextDay : '[i morgen kl.] LT',
            nextWeek : 'på dddd [kl.] LT',
            lastDay : '[i går kl.] LT',
            lastWeek : '[i] dddd[s kl.] LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : 'om %s',
            past : '%s siden',
            s : 'få sekunder',
            ss : '%d sekunder',
            m : 'et minut',
            mm : '%d minutter',
            h : 'en time',
            hh : '%d timer',
            d : 'en dag',
            dd : '%d dage',
            M : 'en måned',
            MM : '%d måneder',
            y : 'et år',
            yy : '%d år'
        },
        dayOfMonthOrdinalParse: /\d{1,2}\./,
        ordinal : '%d.',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return da;

})));

// moment-timezone-localization for lang code: da

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Abidjan","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Accra","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Addis Abeba","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Algier","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Asmara","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Bamako","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Bangui","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Banjul","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Bissau","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Blantyre","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Brazzaville","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Bujumbura","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"Cairo","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Casablanca","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"Ceuta","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"Conakry","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Dakar","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Dar es Salaam","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Djibouti","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Douala","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"El Aaiun","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Freetown","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Gaborone","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Harare","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Johannesburg","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Juba","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Kampala","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Khartoum","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Kigali","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Kinshasa","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Lagos","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Libreville","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Lome","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Luanda","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Lubumbashi","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Lusaka","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Malabo","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Maputo","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Maseru","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Mbabane","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Mogadishu","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Monrovia","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Nairobi","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"Ndjamena","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Niamey","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Nouakchott","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Ouagadougou","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Porto-Novo","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"São Tomé","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Tripoli","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Tunis","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Windhoek","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Adak","id":"America/Adak"},{"value":"America/Anchorage","name":"Anchorage","id":"America/Anchorage"},{"value":"America/Anguilla","name":"Anguilla","id":"America/Anguilla"},{"value":"America/Antigua","name":"Antigua","id":"America/Antigua"},{"value":"America/Araguaina","name":"Araguaina","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"La Rioja","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Rio Gallegos","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Salta","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"San Juan","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"San Luis","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Tucuman","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ushuaia","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Aruba","id":"America/Aruba"},{"value":"America/Asuncion","name":"Asunción","id":"America/Asuncion"},{"value":"America/Bahia","name":"Bahia","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Bahia Banderas","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"Barbados","id":"America/Barbados"},{"value":"America/Belem","name":"Belem","id":"America/Belem"},{"value":"America/Belize","name":"Belize","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Blanc-Sablon","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Boa Vista","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Bogota","id":"America/Bogota"},{"value":"America/Boise","name":"Boise","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Buenos Aires","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Cambridge Bay","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Campo Grande","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Cancun","id":"America/Cancun"},{"value":"America/Caracas","name":"Caracas","id":"America/Caracas"},{"value":"America/Catamarca","name":"Catamarca","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Cayenne","id":"America/Cayenne"},{"value":"America/Cayman","name":"Caymanøerne","id":"America/Cayman"},{"value":"America/Chicago","name":"Chicago","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Chihuahua","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Atikokan","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Cordoba","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Costa Rica","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Creston","id":"America/Creston"},{"value":"America/Cuiaba","name":"Cuiaba","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Curaçao","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Danmarkshavn","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Dawson","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Dawson Creek","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Denver","id":"America/Denver"},{"value":"America/Detroit","name":"Detroit","id":"America/Detroit"},{"value":"America/Dominica","name":"Dominica","id":"America/Dominica"},{"value":"America/Edmonton","name":"Edmonton","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Eirunepe","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"El Salvador","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Fort Nelson","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Fortaleza","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Glace Bay","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"Nuuk","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Goose Bay","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Grand Turk","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Grenada","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Guadeloupe","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Guatemala","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Guayaquil","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Guyana","id":"America/Guyana"},{"value":"America/Halifax","name":"Halifax","id":"America/Halifax"},{"value":"America/Havana","name":"Havana","id":"America/Havana"},{"value":"America/Hermosillo","name":"Hermosillo","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Knox, Indiana","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Marengo, Indiana","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Petersburg, Indiana","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Tell City, Indiana","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Vevay, Indiana","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Vincennes, Indiana","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Winamac, Indiana","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Indianapolis","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Inuvik","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Iqaluit","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Jamaica","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Jujuy","id":"America/Jujuy"},{"value":"America/Juneau","name":"Juneau","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Monticello, Kentucky","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Kralendijk","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"La Paz","id":"America/La_Paz"},{"value":"America/Lima","name":"Lima","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Los Angeles","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Louisville","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Lower Prince’s Quarter","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Maceio","id":"America/Maceio"},{"value":"America/Managua","name":"Managua","id":"America/Managua"},{"value":"America/Manaus","name":"Manaus","id":"America/Manaus"},{"value":"America/Marigot","name":"Marigot","id":"America/Marigot"},{"value":"America/Martinique","name":"Martinique","id":"America/Martinique"},{"value":"America/Matamoros","name":"Matamoros","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Mazatlan","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Mendoza","id":"America/Mendoza"},{"value":"America/Menominee","name":"Menominee","id":"America/Menominee"},{"value":"America/Merida","name":"Merida","id":"America/Merida"},{"value":"America/Metlakatla","name":"Metlakatla","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Mexico City","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Miquelon","id":"America/Miquelon"},{"value":"America/Moncton","name":"Moncton","id":"America/Moncton"},{"value":"America/Monterrey","name":"Monterrey","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Montevideo","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Montserrat","id":"America/Montserrat"},{"value":"America/Nassau","name":"Nassau","id":"America/Nassau"},{"value":"America/New_York","name":"New York","id":"America/New_York"},{"value":"America/Nipigon","name":"Nipigon","id":"America/Nipigon"},{"value":"America/Nome","name":"Nome","id":"America/Nome"},{"value":"America/Noronha","name":"Noronha","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Beulah, North Dakota","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Center, North Dakota","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"New Salem, North Dakota","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Ojinaga","id":"America/Ojinaga"},{"value":"America/Panama","name":"Panama","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Pangnirtung","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Paramaribo","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Phoenix","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Port-au-Prince","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Port of Spain","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Porto Velho","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Puerto Rico","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Punta Arenas","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Rainy River","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Rankin Inlet","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Recife","id":"America/Recife"},{"value":"America/Regina","name":"Regina","id":"America/Regina"},{"value":"America/Resolute","name":"Resolute","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Rio Branco","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Santa Isabel","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Santarem","id":"America/Santarem"},{"value":"America/Santiago","name":"Santiago","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Santo Domingo","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"São Paulo","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"Ittoqqortoormiit","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Sitka","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"Saint-Barthélemy","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"St. John’s","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"St. Kitts","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"St. Lucia","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"St. Thomas","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"St. Vincent","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"Swift Current","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Tegucigalpa","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"Thule","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Thunder Bay","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Tijuana","id":"America/Tijuana"},{"value":"America/Toronto","name":"Toronto","id":"America/Toronto"},{"value":"America/Tortola","name":"Tortola","id":"America/Tortola"},{"value":"America/Vancouver","name":"Vancouver","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Whitehorse","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Winnipeg","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Yakutat","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Yellowknife","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"Casey","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"Davis","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"Dumont d’Urville","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"Macquarie","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"Mawson","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"McMurdo","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"Palmer","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"Rothera","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"Syowa","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"Troll","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"Vostok","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"Longyearbyen","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"Aden","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"Almaty","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"Amman","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"Anadyr","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"Aktau","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"Aktobe","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Asjkhabad","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"Atyrau","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"Bagdad","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Bahrain","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"Baku","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"Bangkok","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"Barnaul","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"Beirut","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"Bisjkek","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"Brunei","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"Kolkata","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"Chita","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"Tsjojbalsan","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"Colombo","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"Damaskus","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Dhaka","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"Dili","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"Dubai","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"Dusjanbe","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"Famagusta","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"Gaza","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"Hebron","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"Hongkong","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"Hovd","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"Irkutsk","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"Jakarta","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"Jayapura","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"Jerusalem","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"Kabul","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"Kamtjatka","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"Karachi","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Katmandu","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"Khandyga","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"Krasnojarsk","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"Kuala Lumpur","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"Kuching","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"Kuwait","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"Macao","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"Magadan","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"Makassar","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"Manila","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"Muscat","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Nicosia","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"Novokusnetsk","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"Novosibirsk","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"Omsk","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"Oral","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"Phnom Penh","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"Pontianak","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"Pyongyang","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"Qatar","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"Kyzylorda","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"Rangoon","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"Riyadh","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"Ho Chi Minh City","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"Sakhalin","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Samarkand","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Seoul","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Shanghai","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Singapore","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"Srednekolymsk","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"Taipei","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"Tasjkent","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"Tbilisi","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"Teheran","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Thimphu","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Tokyo","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"Tomsk","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"Ulan Bator","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"Ürümqi","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"Ust-Nera","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"Vientiane","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"Vladivostok","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"Jakutsk","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"Jekaterinburg","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"Jerevan","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"Azorerne","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Bermuda","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"De Kanariske Øer","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Kap Verde","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Færøerne","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Madeira","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Reykjavik","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"South Georgia","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"St. Helena","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Stanley","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"Adelaide","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"Brisbane","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"Broken Hill","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"Currie","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"Darwin","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"Eucla","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"Hobart","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"Lindeman","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"Lord Howe","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"Melbourne","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"Perth","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"Sydney","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"Koordineret universaltid","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Amsterdam","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"Andorra","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"Astrakhan","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Athen","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Beograd","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Berlin","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"Bratislava","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"Bruxelles","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Bukarest","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Budapest","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Busingen","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"Chisinau","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"København","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"Irsk normaltidDublin","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Gibraltar","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Guernsey","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Helsinki","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"Isle of Man","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"Istanbul","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Jersey","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Kaliningrad","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Kiev","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"Kirov","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"Lissabon","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Ljubljana","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"Britisk sommertidLondon","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Luxembourg","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Madrid","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Malta","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"Mariehamn","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"Minsk","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"Monaco","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Moskva","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Oslo","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"Paris","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"Podgorica","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"Prag","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Riga","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Rom","id":"Europe/Rome"},{"value":"Europe/Samara","name":"Samara","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"San Marino","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"Sarajevo","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"Saratov","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"Simferopol","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"Skopje","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"Sofia","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Stockholm","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"Tallinn","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"Tirana","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Uljanovsk","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"Uzjhorod","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"Vaduz","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"Vatikanet","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Wien","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"Vilnius","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"Volgograd","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Warszawa","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Zagreb","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Zaporizjzja","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Zürich","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Antananarivo","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"Chagos","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"Juleøerne","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"Cocos","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"Comorerne","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"Kerguelen","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"Mahe","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Maldiverne","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Mauritius","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Mayotte","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"Réunion","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Apia","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"Auckland","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"Bougainville","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"Chatham","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"Påskeøen","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Efate","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"Enderbury","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"Fakaofo","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"Fiji","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"Funafuti","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"Galapagos","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"Gambier","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"Guadalcanal","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"Guam","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"Honolulu","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"Johnston","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"Kiritimati","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"Kosrae","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"Kwajalein","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"Majuro","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"Marquesas","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"Midway","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"Nauru","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"Niue","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"Norfolk","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"Noumea","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"Pago Pago","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"Palau","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"Pitcairn","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"Pohnpei","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"Port Moresby","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"Rarotonga","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"Saipan","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"Tahiti","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Tarawa","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"Tongatapu","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"Chuuk","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"Wake","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"Wallis","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
